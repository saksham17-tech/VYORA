/**
 * Stage 9 — Behavioural tests for Reminder Lifecycle (quiet hours, next occurrence, pause cancels pending, opt-out),
 * OVULA Cycle Compliance (consent gate, red-flag symptom warning, export & delete),
 * Community Moderation (duplicate comment 409 fix, report creation & admin review),
 * and Health-Platform Integrations (connect, metric import, disconnect cleanup).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VYORA_NO_LISTEN = '1';
process.env.VYORA_NO_CRON = '1';
process.env.DATABASE_PATH = './database/test_stage9.sqlite';

const { app } = await import('../src/server.js');
const { isWithinQuietHours, computeNextOccurrenceIso } = await import('../src/services/reminderScheduler.js');
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
    fs.rmSync('./database/test_stage9.sqlite', { force: true });
    fs.rmSync('./database/test_stage9.sqlite-wal', { force: true });
    fs.rmSync('./database/test_stage9.sqlite-shm', { force: true });
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
  return { status: res.status, data };
}

test('Stage 9: quiet hours helper, voice confirmation read-back, nextOccurrence, and opt-out', async () => {
  assert.equal(isWithinQuietHours('23:15', '22:00', '07:00'), true);
  assert.equal(isWithinQuietHours('06:30', '22:00', '07:00'), true);
  assert.equal(isWithinQuietHours('09:00', '22:00', '07:00'), false);
  assert.ok(computeNextOccurrenceIso('08:30', 'Asia/Kolkata'));

  const guest = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Kiran' } });
  const token = guest.data.token;

  // Unconfirmed voice reminder must request read-back confirmation first
  const voiceUnconfirmed = await api('/api/reminders', {
    method: 'POST',
    token,
    body: {
      label: 'Thyronorm',
      time: '07:30',
      channel: 'email',
      email: 'kiran@example.com',
      timezone: 'Asia/Kolkata',
      consent: true,
      source: 'voice',
      voiceConfirmed: false
    }
  });
  assert.equal(voiceUnconfirmed.status, 400);
  assert.equal(voiceUnconfirmed.data.code, 'VOICE_CONFIRMATION_REQUIRED');

  // Confirmed reminder succeeds and returns nextOccurrence
  const created = await api('/api/reminders', {
    method: 'POST',
    token,
    body: {
      label: 'Thyronorm',
      time: '07:30',
      channel: 'email',
      email: 'kiran@example.com',
      timezone: 'Asia/Kolkata',
      quietStart: '22:00',
      quietEnd: '06:30',
      consent: true,
      source: 'voice',
      voiceConfirmed: true
    }
  });
  assert.equal(created.status, 201);
  assert.ok(created.data.nextOccurrence);
  assert.equal(created.data.minimalPreview, true);

  // Opt-out pauses reminders
  const optOut = await api('/api/reminders/opt-out', {
    method: 'POST',
    token,
    body: { channel: 'email' }
  });
  assert.equal(optOut.status, 200);
  assert.equal(optOut.data.pausedReminders, 1);
});

test('Stage 9: OVULA /api/ovula/cycle consent gate, red-flag alert, export, and delete', async () => {
  const guest = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Ananya' } });
  const token = guest.data.token;

  // Log cycle entry with red-flag symptom -> returns redFlagAlert & disclaimer
  const cycleRes = await api('/api/ovula/cycle', {
    method: 'POST',
    token,
    body: {
      entry: {
        phase: 'menstrual',
        symptoms: 'unusually heavy bleeding and feeling faint',
        mood: 'anxious'
      },
      consent: true
    }
  });
  assert.equal(cycleRes.status, 201);
  assert.match(cycleRes.data.disclaimer, /contraception/i);
  assert.match(cycleRes.data.redFlagAlert, /urgent/i);

  // Export OVULA data
  const exp = await api('/api/ovula/export', { token });
  assert.equal(exp.status, 200);
  assert.equal(exp.data.entries.length, 1);

  // Delete OVULA data (which also revokes ovula_cycle consent)
  const del = await api('/api/ovula/data', { method: 'DELETE', token });
  assert.equal(del.status, 200);
  assert.equal(del.data.deletedEntries, 1);

  // Posting again without re-granting consent is blocked with 403 CONSENT_REQUIRED
  const blocked = await api('/api/ovula/cycle', {
    method: 'POST',
    token,
    body: { entry: { phase: 'follicular' }, consent: false }
  });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'CONSENT_REQUIRED');
});

test('Stage 9: Community duplicate comment returns 409 (not 500), reports & moderation queue work', async () => {
  const guest = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Dev' } });
  const token = guest.data.token;

  const post = await api('/api/community/posts', {
    method: 'POST',
    token,
    body: { title: 'Morning mobility routine', body: '10 minutes of hip and thoracic work.', type: 'article' }
  });
  assert.equal(post.status, 201);
  const postId = post.data.id;

  const c1 = await api(`/api/community/posts/${postId}/comments`, {
    method: 'POST',
    token,
    body: { body: 'Great mobility tip!' }
  });
  assert.equal(c1.status, 201);

  // Duplicate comment returns 409 Conflict instead of crashing with 500
  const c2 = await api(`/api/community/posts/${postId}/comments`, {
    method: 'POST',
    token,
    body: { body: 'Great mobility tip!' }
  });
  assert.equal(c2.status, 409);
  assert.equal(c2.data.code, 'DUPLICATE_COMMENT');

  // Report post and moderate report
  const rep = await api('/api/community/reports', {
    method: 'POST',
    token,
    body: { postId, reason: 'spam', details: 'Duplicate promotional link' }
  });
  assert.equal(rep.status, 201);

  const mod = await api(`/api/admin/reports/${rep.data.id}`, {
    method: 'PATCH',
    token,
    body: { status: 'resolved', removePost: false }
  });
  assert.equal(mod.status, 200);
  assert.equal(mod.data.status, 'resolved');
});

test('Stage 9: Health integrations connect, metric import, progress tracking, and disconnect cleanup', async () => {
  const guest = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Vikram' } });
  const token = guest.data.token;

  // Connect Android Health Connect bridge with consent
  const conn = await api('/api/integrations/android_health_connect/connect', {
    method: 'POST',
    token,
    body: { consent: true, scopes: ['steps', 'sleep'] }
  });
  assert.equal(conn.status, 201);
  assert.equal(conn.data.status, 'consented_manual_bridge');

  // Import metric under connected provider
  const metric = await api('/api/integrations/metrics', {
    method: 'POST',
    token,
    body: { provider: 'android_health_connect', metricType: 'steps', value: 8420, unit: 'steps' }
  });
  assert.equal(metric.status, 201);

  // Disconnect and clean up imported metrics
  const disc = await api('/api/integrations/android_health_connect/disconnect', {
    method: 'POST',
    token,
    body: { deleteImportedMetrics: true }
  });
  assert.equal(disc.status, 200);
  assert.equal(disc.data.status, 'disconnected');
  assert.equal(disc.data.deletedMetrics, 1);

  // Manual progress entry with unit validation
  const prog = await api('/api/progress', {
    method: 'POST',
    token,
    body: { type: 'body_weight', value: 71.4, unit: 'kg', source: 'manual' }
  });
  assert.equal(prog.status, 201);
});
