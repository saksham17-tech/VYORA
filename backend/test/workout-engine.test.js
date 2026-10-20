/**
 * Workout engine tests — structure, session length, limitation rules, 100+ profile sweep.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkoutPlan, buildAdaptivePlan } from '../src/services/planEngine.js';
import { exerciseLibrary } from '../src/services/exerciseLibrary.js';

test('exercise library has at least 60 entries with required fields', () => {
  assert.ok(exerciseLibrary.length >= 60, `expected ≥60 exercises, got ${exerciseLibrary.length}`);
  for (const item of exerciseLibrary) {
    assert.ok(item.id && item.name);
    assert.ok(item.muscleGroup && item.pattern);
    assert.ok(Array.isArray(item.equipment) && item.equipment.length);
    assert.ok(['beginner', 'intermediate', 'advanced'].includes(item.difficulty));
    assert.ok(Array.isArray(item.contraindications));
    assert.ok(Array.isArray(item.substitutions));
    assert.ok(item.cue && item.videoQuery);
  }
});

test('buildWorkoutPlan returns 7 days with warm-up, exercises, cool-down and progression note', () => {
  const plan = buildWorkoutPlan({
    goal: 'musclegain',
    experience: 'beginner',
    daysPerWeek: 4,
    sessionMinutes: 40,
    equipment: 'dumbbells',
    limitations: []
  });
  assert.equal(plan.days.length, 7);
  assert.ok(plan.weeklyProgressionNote && /progression/i.test(plan.weeklyProgressionNote));
  for (const day of plan.days) {
    assert.ok(day.day && day.focus);
    assert.ok(typeof day.warmUp === 'string' && day.warmUp.length);
    assert.ok(typeof day.coolDown === 'string' && day.coolDown.length);
    assert.ok(Array.isArray(day.exercises) && day.exercises.length >= 2);
    assert.ok(day.durationMin >= 15 && day.durationMin <= 40);
    for (const exercise of day.exercises) {
      assert.ok(exercise.name && exercise.prescription);
      assert.ok(exercise.rest !== undefined);
      assert.ok(exercise.intensityRpe);
      assert.ok(exercise.formCue);
    }
  }
  const trainingDays = plan.days.filter(day => !/recovery/i.test(day.focus));
  assert.ok(trainingDays.length >= 4);
});

test('knee limitation avoids contraindicated squat/lunge patterns', () => {
  const plan = buildWorkoutPlan({
    goal: 'general',
    experience: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 30,
    equipment: 'none',
    limitations: ['knee']
  });
  const names = plan.days.flatMap(day => day.exercises.map(exercise => exercise.name.toLowerCase()));
  assert.ok(!names.some(name => /\blunge\b/.test(name) && !/supported|split/.test(name) || /\bjumping jack\b/.test(name)));
  // Should not include primary knee-contraindicated library names without substitution path
  const kneeIds = exerciseLibrary.filter(item => item.contraindications.includes('knee')).map(item => item.name.toLowerCase());
  for (const name of names) {
    if (kneeIds.includes(name)) {
      assert.fail(`knee-contraindicated exercise present: ${name}`);
    }
  }
});

test('back limitation avoids hinge contraindications', () => {
  const plan = buildWorkoutPlan({
    goal: 'musclegain',
    experience: 'intermediate',
    daysPerWeek: 4,
    sessionMinutes: 45,
    equipment: 'full_gym',
    limitations: ['back']
  });
  const names = plan.days.flatMap(day => day.exercises.map(exercise => exercise.name.toLowerCase()));
  for (const name of names) {
    const match = exerciseLibrary.find(item => item.name.toLowerCase() === name);
    if (match) assert.equal(match.contraindications.includes('back'), false, name);
  }
});

test('shoulder limitation avoids shoulder contraindications', () => {
  const plan = buildWorkoutPlan({
    goal: 'recomp',
    experience: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 30,
    equipment: 'minimal',
    limitations: ['shoulder']
  });
  const names = plan.days.flatMap(day => day.exercises.map(exercise => exercise.name.toLowerCase()));
  for (const name of names) {
    const match = exerciseLibrary.find(item => item.name.toLowerCase() === name);
    if (match) assert.equal(match.contraindications.includes('shoulder'), false, name);
  }
});

test('session duration respects requested sessionMinutes on training days', () => {
  for (const minutes of [20, 35, 60]) {
    const plan = buildWorkoutPlan({
      goal: 'endurance',
      experience: 'beginner',
      daysPerWeek: 3,
      sessionMinutes: minutes,
      equipment: 'none'
    });
    for (const day of plan.days) {
      if (/recovery/i.test(day.focus)) {
        assert.ok(day.durationMin <= minutes);
      } else {
        assert.equal(day.durationMin, minutes);
      }
    }
  }
});

test('combined adaptive plan still produces diet meals and workout days', () => {
  const plan = buildAdaptivePlan({
    heightCm: 168,
    weightKg: 64,
    age: 29,
    gender: 'female',
    diet: 'veg',
    goal: 'recomp',
    experience: 'beginner',
    daysPerWeek: 4,
    sessionMinutes: 35,
    equipment: 'minimal',
    activityLevel: 'moderate'
  });
  assert.equal(plan.meals.length, 28);
  assert.equal(plan.days.length, 7);
  assert.ok(plan.weeklyProgressionNote);
});

test('workout profile sweep (≥100) checks structure, length and limitation rules', () => {
  const goals = ['fatloss', 'musclegain', 'recomp', 'endurance', 'general'];
  const experiences = ['beginner', 'intermediate', 'advanced'];
  const equipment = ['none', 'minimal', 'dumbbells', 'full_gym'];
  const daysOptions = [2, 3, 4, 5, 6];
  const limitationSets = [[], ['knee'], ['back'], ['shoulder'], ['knee', 'shoulder']];
  const profiles = [];
  for (const goal of goals) {
    for (const experience of experiences) {
      for (const equip of equipment) {
        for (const daysPerWeek of daysOptions) {
          for (const limitations of limitationSets) {
            profiles.push({
              goal,
              experience,
              equipment: equip,
              daysPerWeek,
              sessionMinutes: 20 + (profiles.length % 5) * 10,
              limitations
            });
          }
        }
      }
    }
  }
  // Deterministic sample of at least 100
  const step = Math.max(1, Math.floor(profiles.length / 120));
  const sample = profiles.filter((_, index) => index % step === 0).slice(0, 120);
  assert.ok(sample.length >= 100, `sample size ${sample.length}`);

  let structureFails = 0;
  let limitationFails = 0;
  let durationFails = 0;
  for (const profile of sample) {
    const plan = buildWorkoutPlan(profile);
    if (plan.days.length !== 7 || !plan.weeklyProgressionNote) structureFails += 1;
    for (const day of plan.days) {
      if (!day.warmUp || !day.coolDown || !Array.isArray(day.exercises) || day.exercises.length < 1) {
        structureFails += 1;
      }
      if (day.durationMin > profile.sessionMinutes) durationFails += 1;
      for (const exercise of day.exercises) {
        const match = exerciseLibrary.find(item => item.name === exercise.name);
        if (!match) continue;
        for (const tag of match.contraindications) {
          if (profile.limitations.some(limitation => limitation.includes(tag))) {
            limitationFails += 1;
          }
        }
      }
    }
  }
  console.log(`Workout sweep: profiles tested ${sample.length}, structureFails ${structureFails}, durationFails ${durationFails}, limitationFails ${limitationFails}`);
  assert.equal(structureFails, 0, `structure failures: ${structureFails}`);
  assert.equal(durationFails, 0, `duration failures: ${durationFails}`);
  assert.equal(limitationFails, 0, `limitation rule failures: ${limitationFails}`);
});
