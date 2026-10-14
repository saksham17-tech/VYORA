/**
 * Stage 5 — AI safety gold-test harness (offline)
 * Tests red-flag detection and policy selection without calling Gemini.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectRedFlags,
  detectHighRiskContext,
  selectPolicy,
  redFlagResponse,
  postCheckAnswer
} from '../src/services/aiSafety.js';

test('detects chest pain red flag', () => {
  const r = detectRedFlags('I have severe chest pain and can\'t breathe');
  assert.equal(r.isRedFlag, true);
});

test('detects suicidal ideation red flag', () => {
  const r = detectRedFlags('I want to kill myself');
  assert.equal(r.isRedFlag, true);
});

test('detects heavy bleeding red flag', () => {
  const r = detectRedFlags('I have unusually heavy bleeding and feel faint');
  assert.equal(r.isRedFlag, true);
});

test('normal fitness question is not a red flag', () => {
  const r = detectRedFlags('Give me a 20 minute no-equipment workout');
  assert.equal(r.isRedFlag, false);
});

test('selectPolicy escalates on red flag', () => {
  const p = selectPolicy('vyora', 'I am having chest pain right now');
  assert.equal(p.escalate, true);
  assert.equal(p.mode, 'high_risk');
});

test('selectPolicy uses ovula mode', () => {
  const p = selectPolicy('ovula', 'Any tips for period cramps?');
  assert.equal(p.mode, 'ovula');
  assert.equal(p.escalate, false);
});

test('selectPolicy uses nutrition mode for meal questions', () => {
  const p = selectPolicy('vyora', 'Suggest a vegetarian dinner with no eggs');
  assert.equal(p.mode, 'nutrition');
});

test('selectPolicy uses high_risk for pregnancy context', () => {
  const p = selectPolicy('vyora', 'I am pregnant, what workouts are safe?');
  assert.equal(p.mode, 'high_risk');
});

test('redFlagResponse advises urgent care and refuses plans', () => {
  const r = redFlagResponse();
  assert.match(r.answer, /urgent/i);
  assert.match(r.answer, /will not generate/i);
  assert.equal(r.safety.escalated, true);
});

test('postCheckAnswer flags diagnosis-like language', () => {
  const c = postCheckAnswer('Based on your symptoms you have PCOS and need treatment.');
  assert.equal(c.ok, false);
  assert.ok(c.issues.includes('possible_diagnosis_language'));
});

test('postCheckAnswer flags medication change advice', () => {
  const c = postCheckAnswer('You should stop taking your current dose and increase it.');
  assert.equal(c.ok, false);
  assert.ok(c.issues.includes('medication_change_advice'));
});

test('postCheckAnswer accepts clean general advice', () => {
  const c = postCheckAnswer('Try a gentle 15-minute walk and stay hydrated. Listen to your body.');
  assert.equal(c.ok, true);
});
