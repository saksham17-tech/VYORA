/**
 * Stage 10 — Behavioural tests for Cross-User Authorization Isolation (MVP Acceptance Criterion 11),
 * Scheduler Idempotency & Restart Recovery, Request-ID & CSP Security Headers,
 * Zero Frontend `innerHTML` Regression Check, and PostgreSQL Placeholder Translation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

process.env.VYORA_NO_LISTEN = '1';
process.env.VYORA_NO_CRON = '1';
process.env.DATABASE_PATH = './database/test_stage10.sqlite';

const { app } = await import('../src/server.js');
const { startReminderScheduler, localParts } = await import('../src/services/reminderScheduler.js');
const { sqliteToPostgresPlaceholders } = await import('../src/db-postgres.js');

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
    fs.rmSync('./database/test_stage10.sqlite', { force: true });
    fs.rmSync('./database/test_stage10.sqlite-wal', { force: true });
    fs.rmSync('./database/test_stage10.sqlite-shm', { force: true });
  } catch {}
});

async function api(urlPath, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

test('Stage 10: cross-user authorization isolation — User B cannot read or modify User A plans, workouts, vitals, OVULA entries, or reminders', async () => {
  const uA = await api('/api/session/guest', { method: 'POST', body: { displayName: 'User A' } });
  const uB = await api('/api/session/guest', { method: 'POST', body: { displayName: 'User B' } });
  const tokenA = uA.data.token;
  const tokenB = uB.data.token;

  // User A creates a plan, workout, vital, OVULA entry, and reminder
  const planA = await api('/api/plans/generate', {
    method: 'POST',
    token: tokenA,
    body: { heightCm: 170, weightKg: 68, diet: 'veg', goal: 'fatloss' }
  });
  const workoutA = await api('/api/workouts', {
    method: 'POST',
    token: tokenA,
    body: { log: { day: 'Mon', exercise: 'Push-Up', volume: '3x10' } }
  });
  const vitalA = await api('/api/vitals', {
    method: 'POST',
    token: tokenA,
    body: { bp: '118/78', sugar: 95 }
  });
  const ovulaA = await api('/api/ovula/cycle', {
    method: 'POST',
    token: tokenA,
    body: { entry: { phase: 'luteal', mood: 'calm' }, consent: true }
  });
  const remA = await api('/api/reminders', {
    method: 'POST',
    token: tokenA,
    body: { label: 'Vitamin D', time: '09:00', channel: 'email', email: 'a@example.com', timezone: 'Asia/Kolkata', consent: true }
  });

  // User B attempts to read or modify User A's records -> all must be isolated / 404
  assert.equal((await api(`/api/plans/${planA.data.id}`, { token: tokenB })).status, 404);
  assert.equal((await api(`/api/plans/${planA.data.id}`, { method: 'PATCH', token: tokenB, body: { instruction: 'no eggs today' } })).status, 404);
  assert.equal((await api(`/api/plans/${planA.data.id}`, { method: 'DELETE', token: tokenB })).status, 404);
  assert.equal((await api(`/api/workouts/${workoutA.data.id}`, { method: 'DELETE', token: tokenB })).status, 404);
  assert.equal((await api(`/api/vitals/${vitalA.data.id}`, { method: 'DELETE', token: tokenB })).status, 404);
  assert.equal((await api(`/api/ovula/entries/${ovulaA.data.id}`, { method: 'DELETE', token: tokenB })).status, 404);
  assert.equal((await api(`/api/reminders/${remA.data.id}`, { method: 'PATCH', token: tokenB, body: { active: false } })).status, 404);
  assert.equal((await api(`/api/reminders/${remA.data.id}/deliveries`, { token: tokenB })).status, 404);

  // User B's list endpoints return empty arrays (never User A's records)
  assert.equal((await api('/api/plans', { token: tokenB })).data.length, 0);
  assert.equal((await api('/api/ovula/cycle', { token: tokenB })).data.length, 0);
  assert.equal((await api('/api/reminders', { token: tokenB })).data.length, 0);
});

test('Stage 10: scheduler restart / multiple ticks do not duplicate sends (idempotency via occurrence_key)', async () => {
  const u = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Scheduler User' } });
  const token = u.data.token;

  const fakeNow = new Date('2026-10-14T09:15:00.000Z');
  const p = localParts(fakeNow, 'Asia/Kolkata');
  const dueClock = `${p.hour}:${p.minute}`;

  const rem = await api('/api/reminders', {
    method: 'POST',
    token,
    body: {
      label: 'Hydration Check',
      time: dueClock,
      channel: 'email',
      email: 'sched@example.com',
      timezone: 'Asia/Kolkata',
      quietStart: '23:00',
      quietEnd: '05:00',
      consent: true
    }
  });
  assert.equal(rem.status, 201);

  let sendCount = 0;
  const mockDeliver = async () => {
    sendCount += 1;
    return { providerId: `mock-msg-${sendCount}` };
  };

  const scheduler = startReminderScheduler({ deliver: mockDeliver });
  scheduler.stop();

  // First tick claims and sends the due reminder
  await scheduler.tick(fakeNow);
  assert.equal(sendCount, 1);

  // Second tick (simulating process restart 5 minutes later within lookback window) MUST NOT duplicate send
  const fiveMinLater = new Date(fakeNow.getTime() + 5 * 60 * 1000);
  await scheduler.tick(fiveMinLater);
  assert.equal(sendCount, 1);

  const deliveries = await api(`/api/reminders/${rem.data.id}/deliveries`, { token });
  assert.equal(deliveries.status, 200);
  assert.equal(deliveries.data.length, 1);
  assert.equal(deliveries.data[0].status, 'sent');
});

test('Stage 10: CSP & X-Request-Id headers present, zero frontend innerHTML usage, and Postgres placeholder helper works', async () => {
  const h = await api('/api/health/ready');
  assert.equal(h.status, 200);
  assert.equal(h.data.ok, true);
  assert.ok(h.headers.get('x-request-id'));
  assert.ok(h.headers.get('content-security-policy'));
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff');

  // Verify zero `.innerHTML` usage across all frontend JS files
  const jsDir = path.resolve(process.cwd(), 'frontend/public/js');
  for (const file of fs.readdirSync(jsDir)) {
    if (!file.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(jsDir, file), 'utf8');
    assert.doesNotMatch(content, /\.innerHTML\s*=/, `Found unsafe innerHTML in ${file}`);
  }

  // Verify SQLite -> Postgres placeholder translation
  const pgSql = sqliteToPostgresPlaceholders('SELECT * FROM reminders WHERE user_id = ? AND active = ?');
  assert.equal(pgSql, 'SELECT * FROM reminders WHERE user_id = $1 AND active = $2');
});
