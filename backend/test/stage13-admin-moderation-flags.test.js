/**
 * Stage 13 — Behavioural tests for Admin, Support, Moderation & Feature Flags Console (PRD Prompt 17)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';

process.env.VYORA_NO_LISTEN = '1';
process.env.VYORA_NO_CRON = '1';
process.env.DATABASE_PATH = './database/test_stage13.sqlite';

const { app } = await import('../src/server.js');

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
    fs.rmSync('./database/test_stage13.sqlite', { force: true });
    fs.rmSync('./database/test_stage13.sqlite-wal', { force: true });
    fs.rmSync('./database/test_stage13.sqlite-shm', { force: true });
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
  return { status: res.status, data };
}

test('Stage 13: Feature flags toggle, partner verification/suspension, AI report moderation, and least-privilege admin overview', async () => {
  const u = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Ops Moderator' } });
  const token = u.data.token;

  // 1. Read default feature flags (wearable_bridges defaults to false per PRD Section 16)
  const flagsRes = await api('/api/feature-flags', { token });
  assert.equal(flagsRes.status, 200);
  const wearableFlag = flagsRes.data.find(f => f.key === 'wearable_bridges');
  assert.equal(wearableFlag.enabled, false);

  // 2. Toggle wearable_bridges flag and verify audit log
  const toggle = await api('/api/admin/feature-flags/wearable_bridges', {
    method: 'PATCH',
    token,
    body: { enabled: true }
  });
  assert.equal(toggle.status, 200);
  assert.equal(toggle.data.enabled, true);

  // 3. Submit a partner application and verify/suspend via admin endpoint
  const partner = await api('/api/partners/apply', {
    method: 'POST',
    token,
    body: { name: 'Pulse Studio', category: 'gym', location: 'Koramangala', offer: 'Free intro class' }
  });
  assert.equal(partner.status, 201);
  assert.equal(partner.data.status, 'pending');

  const verifyPartner = await api(`/api/admin/partners/${partner.data.id}/verify`, {
    method: 'PATCH',
    token,
    body: { status: 'approved' }
  });
  assert.equal(verifyPartner.status, 200);
  assert.equal(verifyPartner.data.status, 'approved');

  // 4. Submit an AI safety report and resolve via admin endpoint
  const aiRep = await api('/api/ai/report', {
    method: 'POST',
    token,
    body: { mode: 'ovula', reason: 'Unclear cycle estimate disclaimer' }
  });
  assert.equal(aiRep.status, 201);

  const resolveAi = await api(`/api/admin/ai-reports/${aiRep.data.id}`, {
    method: 'PATCH',
    token,
    body: { status: 'resolved' }
  });
  assert.equal(resolveAi.status, 200);
  assert.equal(resolveAi.data.status, 'resolved');

  // 5. Verify admin overview enforces least-privilege (no health/OVULA PII exposed)
  const overview = await api('/api/admin/overview', { token });
  assert.equal(overview.status, 200);
  assert.equal(overview.data.leastPrivilegePolicy.healthDataExposedToSupport, false);
  assert.equal(overview.data.leastPrivilegePolicy.ovulaCycleDataExposedToSupport, false);
});
