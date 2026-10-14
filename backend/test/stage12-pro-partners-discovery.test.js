/**
 * Stage 12 — Behavioural tests for VYORA Pro Trainer Sharing/Revocation, Rescheduling & Reviews,
 * Partner Campaign Sensitive-Targeting Prohibition & Aggregated Analytics,
 * and Local Discovery Place Inaccuracy Reporting & Location History Clearing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';

process.env.VYORA_NO_LISTEN = '1';
process.env.VYORA_NO_CRON = '1';
process.env.DATABASE_PATH = './database/test_stage12.sqlite';

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
    fs.rmSync('./database/test_stage12.sqlite', { force: true });
    fs.rmSync('./database/test_stage12.sqlite-wal', { force: true });
    fs.rmSync('./database/test_stage12.sqlite-shm', { force: true });
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

test('Stage 12: VYORA Pro trainer sharing & instant revocation, booking reschedule, and trainer reviews', async () => {
  const u = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Siddharth' } });
  const token = u.data.token;

  // 1. Share selected progress scopes with trainer-strength-1
  const share = await api('/api/trainers/trainer-strength-1/share', {
    method: 'POST',
    token,
    body: { scopes: ['goals', 'workouts'] }
  });
  assert.equal(share.status, 201);
  assert.equal(share.data.active, true);

  // 2. Verify active share appears in /api/trainers/shares
  const shares1 = await api('/api/trainers/shares', { token });
  assert.equal(shares1.data.length, 1);
  assert.equal(shares1.data[0].active, true);

  // 3. Revoke trainer access -> immediately inactive
  const rev = await api('/api/trainers/trainer-strength-1/share', { method: 'DELETE', token });
  assert.equal(rev.status, 200);
  assert.equal(rev.data.active, false);

  // 4. Book, reschedule, and review trainer
  const book = await api('/api/trainers/bookings', {
    method: 'POST',
    token,
    body: { trainerId: 'trainer-strength-1', requestedAt: '2026-10-20T10:00:00.000Z', notes: 'Form check' }
  });
  assert.equal(book.status, 201);

  const resched = await api(`/api/bookings/${book.data.id}`, {
    method: 'PATCH',
    token,
    body: { requestedAt: '2026-10-21T11:30:00.000Z' }
  });
  assert.equal(resched.status, 200);
  assert.equal(resched.data.requestedAt, '2026-10-21T11:30:00.000Z');

  const review = await api('/api/trainers/trainer-strength-1/reviews', {
    method: 'POST',
    token,
    body: { rating: 5, comment: 'Clear, progressive cues.' }
  });
  assert.equal(review.status, 201);
});

test('Stage 12: Partner campaign blocks sensitive medical/menstrual targeting and tracks aggregate-only analytics; Places supports inaccuracy report & history wipe', async () => {
  const u = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Partner Owner' } });
  const token = u.data.token;

  // 1. Sensitive condition targeting must be rejected per PRD Prompt 14
  const badCamp = await api('/api/campaigns', {
    method: 'POST',
    token,
    body: { name: 'Special Supplement', offer: '20% off', targeting: 'users with PCOS or diabetes' }
  });
  assert.equal(badCamp.status, 400);
  assert.equal(badCamp.data.code, 'SENSITIVE_TARGETING_PROHIBITED');

  // 2. Valid campaign + aggregate event recording
  const camp = await api('/api/campaigns', {
    method: 'POST',
    token,
    body: { name: 'Iron Loft 7-Day Pass', offer: 'Free 7-day trial', date: '2026-11-01' }
  });
  assert.equal(camp.status, 201);

  await api(`/api/campaigns/${camp.data.id}/events`, { method: 'POST', token, body: { eventType: 'impression' } });
  await api(`/api/campaigns/${camp.data.id}/events`, { method: 'POST', token, body: { eventType: 'click' } });
  await api(`/api/campaigns/${camp.data.id}/events`, { method: 'POST', token, body: { eventType: 'opt_in' } });

  const stats = await api(`/api/campaigns/${camp.data.id}/analytics`, { token });
  assert.equal(stats.status, 200);
  assert.equal(stats.data.analytics.impressions, 1);
  assert.equal(stats.data.analytics.clicks, 1);
  assert.equal(stats.data.analytics.optIns, 1);

  // 3. Place inaccuracy reporting and location history clearing
  const place = await api('/api/places', {
    method: 'POST',
    token,
    body: { name: 'Green Bowl Café', category: 'cafe', address: 'Indiranagar' }
  });
  assert.equal(place.status, 201);

  const rep = await api(`/api/places/${place.data.id}/report`, {
    method: 'POST',
    token,
    body: { issue: 'Operating hours changed to 8 AM' }
  });
  assert.equal(rep.status, 201);

  const wipe = await api('/api/places', { method: 'DELETE', token });
  assert.equal(wipe.status, 200);
  assert.equal(wipe.data.deletedPlaces, 1);
});
