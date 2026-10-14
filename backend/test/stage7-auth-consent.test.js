/**
 * Stage 7 — Behavioural tests for Auth, OTP verification, Verified Destination Enforcement,
 * Purpose-Specific Consents, and Audit Logging.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VYORA_NO_LISTEN = '1';
process.env.VYORA_NO_CRON = '1';
process.env.DATABASE_PATH = './database/test_stage7.sqlite';

const { app } = await import('../src/server.js');
import http from 'node:http';
import fs from 'node:fs';

let server;
let baseUrl;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try {
    fs.rmSync('./database/test_stage7.sqlite', { force: true });
    fs.rmSync('./database/test_stage7.sqlite-wal', { force: true });
    fs.rmSync('./database/test_stage7.sqlite-shm', { force: true });
  } catch {}
});

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

test('Stage 7: guest session -> link-guest -> unverified reminder blocked -> OTP verify -> reminder allowed', async () => {
  // 1. Create guest session
  const guestRes = await api('/api/session/guest', {
    method: 'POST',
    body: { displayName: 'Aarav Guest' }
  });
  assert.equal(guestRes.status, 201);
  const guestToken = guestRes.data.token;
  assert.ok(guestToken);

  // 2. Save a workout under guest session
  const wRes = await api('/api/workouts', {
    method: 'POST',
    token: guestToken,
    body: { log: { day: 'Mon', exercise: 'Squat', volume: '4x8' } }
  });
  assert.equal(wRes.status, 201);

  // 3. Link guest session to registered account
  const email = `aarav.${Date.now()}@example.com`;
  const linkRes = await api('/api/auth/link-guest', {
    method: 'POST',
    token: guestToken,
    body: { email, password: 'Password123!', displayName: 'Aarav Sharma' }
  });
  assert.equal(linkRes.status, 200);
  assert.equal(linkRes.data.user.isGuest, false);
  assert.equal(linkRes.data.user.emailVerified, false);
  const userToken = linkRes.data.token;

  // 4. Verify guest workout log was preserved under the same user ID
  const workoutsAfter = await api('/api/workouts', { token: userToken });
  assert.equal(workoutsAfter.status, 200);
  assert.equal(workoutsAfter.data.length, 1);

  // 5. Unverified registered user MUST be blocked from scheduling email reminders (fixes Stage 2/3 bug)
  const blockedRem = await api('/api/reminders', {
    method: 'POST',
    token: userToken,
    body: {
      label: 'Metformin',
      time: '08:30',
      channel: 'email',
      email,
      timezone: 'Asia/Kolkata',
      consent: true
    }
  });
  assert.equal(blockedRem.status, 403);
  assert.equal(blockedRem.data.code, 'UNVERIFIED_DESTINATION');

  // 6. Request & confirm OTP for email verification
  const otpReq = await api('/api/auth/verify/request', {
    method: 'POST',
    token: userToken,
    body: { channel: 'email', destination: email }
  });
  assert.equal(otpReq.status, 200);
  assert.ok(otpReq.data.devCode);

  const otpConfirm = await api('/api/auth/verify/confirm', {
    method: 'POST',
    token: userToken,
    body: { channel: 'email', destination: email, code: otpReq.data.devCode }
  });
  assert.equal(otpConfirm.status, 200);
  assert.equal(otpConfirm.data.user.emailVerified, true);

  // 7. Verified user still blocked from sending to SOMEONE ELSE'S email
  const wrongDest = await api('/api/reminders', {
    method: 'POST',
    token: userToken,
    body: {
      label: 'Metformin',
      time: '08:30',
      channel: 'email',
      email: 'stranger@example.com',
      timezone: 'Asia/Kolkata',
      consent: true
    }
  });
  assert.equal(wrongDest.status, 403);

  // 8. Verified user can now schedule reminder to their own verified email
  const okRem = await api('/api/reminders', {
    method: 'POST',
    token: userToken,
    body: {
      label: 'Metformin',
      time: '08:30',
      channel: 'email',
      email,
      timezone: 'Asia/Kolkata',
      consent: true
    }
  });
  assert.equal(okRem.status, 201);
  assert.equal(okRem.data.label, 'Metformin');
});

test('Stage 7: purpose-specific consent grant/revoke and audit trail', async () => {
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      email: `priya.${Date.now()}@example.com`,
      password: 'Password123!',
      displayName: 'Priya Nair'
    }
  });
  assert.equal(reg.status, 201);
  const token = reg.data.token;

  // Grant OVULA consent
  const grant = await api('/api/consents', {
    method: 'POST',
    token,
    body: { purpose: 'ovula_cycle', scope: 'cycle_tracking' }
  });
  assert.equal(grant.status, 201);
  assert.equal(grant.data.active, true);

  // List consents
  const list = await api('/api/consents', { token });
  assert.equal(list.status, 200);
  assert.ok(list.data.consents.some(c => c.purpose === 'ovula_cycle' && c.active));

  // Revoke OVULA consent
  const rev = await api('/api/consents/ovula_cycle', { method: 'DELETE', token });
  assert.equal(rev.status, 200);

  const listAfter = await api('/api/consents', { token });
  assert.ok(listAfter.data.consents.every(c => c.purpose !== 'ovula_cycle' || !c.active));

  // Check audit trail recorded registration, consent grant, and consent revoke
  const audit = await api('/api/audit', { token });
  assert.equal(audit.status, 200);
  const actions = audit.data.map(a => a.action);
  assert.ok(actions.includes('auth.register'));
  assert.ok(actions.includes('consent.granted'));
  assert.ok(actions.includes('consent.revoked'));
});

test('Stage 7: password reset flow works with OTP', async () => {
  const email = `reset.${Date.now()}@example.com`;
  await api('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'OldPassword123!', displayName: 'Reset User' }
  });

  const reqReset = await api('/api/auth/password-reset/request', {
    method: 'POST',
    body: { email }
  });
  assert.equal(reqReset.status, 200);
  assert.ok(reqReset.data.devCode);

  const confirmReset = await api('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: { email, code: reqReset.data.devCode, newPassword: 'NewPassword456!' }
  });
  assert.equal(confirmReset.status, 200);

  const loginNew = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'NewPassword456!' }
  });
  assert.equal(loginNew.status, 200);
  assert.ok(loginNew.data.token);
});
