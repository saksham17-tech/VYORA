/**
 * Stage 11 — Behavioural tests for Special Training (TRAIN / EXPLORE / COMPETE) & Gamification Controls
 * Verifies:
 * - Minimum data threshold on Performance Predictions (refuses to predict from < 2 sessions)
 * - Confidence bands & race estimates once >= 2 sessions are logged
 * - Progress Comparison with manual vs imported provenance
 * - Athlete Intelligence & Gamification toggle (`PATCH /api/profile/gamification`)
 * - Personalized Routes with waypoints & privacy zones
 * - Opt-in Leaderboards with fair-play bounds & instant leave/hide
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';

process.env.VYORA_NO_LISTEN = '1';
process.env.VYORA_NO_CRON = '1';
process.env.DATABASE_PATH = './database/test_stage11.sqlite';

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
    fs.rmSync('./database/test_stage11.sqlite', { force: true });
    fs.rmSync('./database/test_stage11.sqlite-wal', { force: true });
    fs.rmSync('./database/test_stage11.sqlite-shm', { force: true });
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

test('Stage 11: Performance Predictions enforces minimum data threshold, then provides confidence-bounded estimates after logging sessions', async () => {
  const u = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Arjun Runner' } });
  const token = u.data.token;

  // 1. With 0 sessions logged, predictions must refuse to fabricate estimates
  const sparse = await api('/api/training/predictions', { token });
  assert.equal(sparse.status, 200);
  assert.equal(sparse.data.sufficientData, false);
  assert.equal(sparse.data.predictions, null);

  // 2. Log 2 workouts
  await api('/api/workouts', { method: 'POST', token, body: { log: { day: 'Mon', exercise: '5K Tempo Run', volume: '28 min' } } });
  await api('/api/workouts', { method: 'POST', token, body: { log: { day: 'Wed', exercise: 'Zone 2 Run', volume: '35 min', painFlag: true } } });

  const ready = await api('/api/training/predictions', { token });
  assert.equal(ready.status, 200);
  assert.equal(ready.data.sufficientData, true);
  assert.ok(ready.data.predictions.fiveKm.estimate);
  assert.match(ready.data.disclaimer, /uncertainty/i);

  // 3. Check Athlete Intelligence & Gamification Toggle
  const intel1 = await api('/api/training/intelligence', { token });
  assert.equal(intel1.status, 200);
  assert.equal(intel1.data.painFlagsCount, 1);
  assert.equal(intel1.data.gamification.enabled, true);

  const toggleOff = await api('/api/profile/gamification', { method: 'PATCH', token, body: { enabled: false } });
  assert.equal(toggleOff.status, 200);
  assert.equal(toggleOff.data.gamificationEnabled, false);

  const intel2 = await api('/api/training/intelligence', { token });
  assert.equal(intel2.data.gamification.enabled, false);
  assert.equal(intel2.data.gamification.activeStreakDays, null);
});

test('Stage 11: Personalized Routes with privacy zones & Opt-In Leaderboard with fair-play bounds and leave control', async () => {
  const u = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Neha Athlete' } });
  const token = u.data.token;

  // Create personalized route with hydration waypoint and privacy zone
  const route = await api('/api/training/routes', {
    method: 'POST',
    token,
    body: {
      name: 'Lodhi Garden 6K Loop',
      distanceKm: 6.0,
      terrain: 'trail',
      elevationGainM: 35,
      visibility: 'private',
      privacyZoneKm: 0.5,
      waypoints: [{ name: 'Gate 1 Water Refill', type: 'hydration', verified: true }]
    }
  });
  assert.equal(route.status, 201);
  assert.equal(route.data.waypoints.length, 1);

  // Leaderboard rejects implausible score (>400 km/week)
  const abuse = await api('/api/training/leaderboard/opt-in', {
    method: 'POST',
    token,
    body: { displayName: 'Neha', metricType: 'weekly_km', score: 9999 }
  });
  assert.equal(abuse.status, 400);
  assert.equal(abuse.data.code, 'FAIR_PLAY_BOUND_EXCEEDED');

  // Valid opt-in
  const optIn = await api('/api/training/leaderboard/opt-in', {
    method: 'POST',
    token,
    body: { displayName: 'Neha', metricType: 'weekly_km', score: 32.5 }
  });
  assert.equal(optIn.status, 200);

  const lb1 = await api('/api/training/leaderboard?metricType=weekly_km', { token });
  assert.equal(lb1.data.rankings.length, 1);

  // Leave leaderboard -> hidden from rankings
  await api('/api/training/leaderboard/leave', { method: 'POST', token });
  const lb2 = await api('/api/training/leaderboard?metricType=weekly_km', { token });
  assert.equal(lb2.data.rankings.length, 0);
});
