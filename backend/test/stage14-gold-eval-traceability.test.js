/**
 * Stage 14 — Behavioural tests for the Automated Gold-Set AI Evaluation Harness (PRD Prompt 18)
 * and Full 20-Prompt Traceability Verification.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

process.env.VYORA_NO_LISTEN = '1';
process.env.VYORA_NO_CRON = '1';
process.env.DATABASE_PATH = './database/test_stage14.sqlite';

const { app } = await import('../src/server.js');
const { runGoldEvaluationSuite, GOLD_TEST_SET } = await import('../src/services/evaluationHarness.js');

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
    fs.rmSync('./database/test_stage14.sqlite', { force: true });
    fs.rmSync('./database/test_stage14.sqlite-wal', { force: true });
    fs.rmSync('./database/test_stage14.sqlite-shm', { force: true });
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

test('Stage 14: Gold-Set Evaluation Harness covers all 9 PRD Prompt 18 categories and achieves 100% pass rate', () => {
  const requiredCategories = [
    'beginner_plans',
    'indian_food_substitutions',
    'allergy_constraints',
    'pain_related_adaptations',
    'ovula_questions',
    'medication_reminders',
    'red_flags',
    'prompt_injection',
    'unsupported_medical_requests'
  ];
  const presentCategories = new Set(GOLD_TEST_SET.map(c => c.category));
  for (const cat of requiredCategories) {
    assert.ok(presentCategories.has(cat), `Missing gold category: ${cat}`);
  }

  const report = runGoldEvaluationSuite();
  assert.equal(report.totalCases, 10);
  assert.equal(report.passedCases, 10);
  assert.equal(report.passRate, 100);
  assert.equal(report.aggregateScores.safety, 1);
  assert.equal(report.aggregateScores.planValidity, 1);
  assert.equal(report.aggregateScores.instructionFollowing, 1);
});

test('Stage 14: GET /api/admin/eval/run executes Gold-Set evaluation via API and logs audit trail, and PRD_20_PROMPTS_TRACEABILITY.md is complete', async () => {
  const u = await api('/api/session/guest', { method: 'POST', body: { displayName: 'QA Evaluator' } });
  const token = u.data.token;

  const evalRes = await api('/api/admin/eval/run', { token });
  assert.equal(evalRes.status, 200);
  assert.equal(evalRes.data.passRate, 100);
  assert.equal(evalRes.data.results.length, 10);

  const traceDoc = fs.readFileSync(path.resolve(process.cwd(), 'docs/PRD_20_PROMPTS_TRACEABILITY.md'), 'utf8');
  for (let i = 1; i <= 20; i++) {
    assert.match(traceDoc, new RegExp(`Prompt ${i}\\b`));
  }
});
