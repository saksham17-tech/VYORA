import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

test('database schema includes core and PRD Stage 4/7 feature tables', () => {
  const sql = fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8');
  for (const table of [
    'users', 'profiles', 'plans', 'workout_logs', 'reminders', 'reminder_deliveries',
    'vitals', 'ovula_entries', 'community_posts', 'partners', 'campaigns', 'trainers',
    'bookings', 'challenges', 'saved_places', 'verification_tokens', 'revoked_tokens',
    'consent_records', 'audit_events', 'integration_connections', 'imported_metrics', 'community_reports'
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
});

test('backend keeps AI and provider credentials server-side across modular files', () => {
  const srcDir = path.join(root, 'backend/src');
  const readAllJs = (dir) => {
    let combined = '';
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) combined += readAllJs(full);
      else if (entry.name.endsWith('.js')) combined += '\n' + fs.readFileSync(full, 'utf8');
    }
    return combined;
  };
  const backendCode = readAllJs(srcDir);
  assert.match(backendCode, /process\.env\.GEMINI_API_KEY/);
  assert.match(backendCode, /Authorization|authorization/);
  assert.match(backendCode, /authOnly/);
  const client = fs.readFileSync(path.join(root, 'frontend/public/js/api.js'), 'utf8');
  assert.doesNotMatch(client, /GEMINI_API_KEY\s*=/);
});

test('frontend API client exposes core and Stage 7 auth/consent workflows', () => {
  const client = fs.readFileSync(path.join(root, 'frontend/public/js/api.js'), 'utf8');
  for (const method of [
    'register', 'login', 'logout', 'linkGuest', 'requestOtp', 'confirmOtp',
    'listConsents', 'grantConsent', 'revokeConsent', 'listAudit',
    'chat', 'addMed', 'addVitals', 'savePlan', 'logWorkout', 'saveOvula',
    'createPost', 'createCampaign', 'bookTrainer', 'createChallenge', 'savePlace', 'exportData'
  ]) {
    assert.match(client, new RegExp(`${method}\\s*:`));
  }
});
