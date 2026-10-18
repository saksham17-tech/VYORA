import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { buildAdaptivePlan } from '../src/services/planEngine.js';
import { foodDatabase } from '../src/services/foodDatabase.js';
import { dishLibrary } from '../src/services/dishLibrary.js';

process.env.VYORA_NO_LISTEN = '1';
process.env.VYORA_NO_CRON = '1';
process.env.DATABASE_PATH = './database/test_diet_personalization.sqlite';

const { app } = await import('../src/server.js');
let server;
let baseUrl;
const PLAN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

test.before(async () => {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`./database/test_diet_personalization.sqlite${suffix}`, { force: true });
    }
  } catch {}
});

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, data: await response.json() };
}

function assertNutrition(plan) {
  assert.equal(plan.meals.length, 28);
  assert.equal(plan.dailyTotals.length, 7);
  for (const total of plan.dailyTotals) {
    const target = plan.estimateMetadata.estimatedDailyKcal;
    assert.ok(Math.abs(total.kcal - target) <= target * 0.05, `${total.day} kcal is outside tolerance`);
    const proteinTarget = plan.estimateMetadata.estimatedProteinG;
    assert.ok(Math.abs(total.proteinG - proteinTarget) <= proteinTarget * 0.1, `${total.day} protein is outside tolerance`);
  }
}

function assertDietRules(plan, diet, allergies = []) {
  const forbidden = diet === 'veg'
    ? /\b(meat|fish|eggs?)\b/i
    : diet === 'vegan'
      ? /\b(dairy|eggs?|honey)\b/i
      : null;
  for (const meal of plan.meals) {
    const text = `${meal.title} ${meal.items.join(' ')}`;
    if (forbidden) assert.doesNotMatch(text, forbidden);
    for (const allergy of allergies) assert.equal(meal.contains.includes(allergy), false);
    assert.ok(meal.foodIds.length <= 6);
    assert.ok(meal.foodIds.filter(id => foodDatabase.find(food => food.id === id)?.role === 'fat_topping').length <= 1);
    if (['Breakfast', 'Lunch', 'Dinner'].includes(meal.slot)) {
      assert.doesNotMatch(meal.title, /whey|protein powder/i);
      assert.equal(meal.foodIds.some(id => foodDatabase.find(food => food.id === id)?.role === 'supplement'), false);
    }
  }
  if (diet === 'keto') {
    for (const total of plan.dailyTotals) {
      assert.ok(total.carbsG * 4 <= total.kcal * 0.1, `${total.day} exceeds keto carb limit`);
    }
  }
}

test('generates diverse seven-day plans with nutrition and dietary constraints', () => {
  const petite = buildAdaptivePlan({
    heightCm: 160, weightKg: 55, age: 29, gender: 'female', diet: 'veg', goal: 'fatloss'
  });
  const larger = buildAdaptivePlan({
    heightCm: 185, weightKg: 90, age: 29, gender: 'male', diet: 'veg', goal: 'musclegain'
  });
  assertNutrition(petite);
  assertNutrition(larger);
  const sharedTitles = petite.meals.filter((meal, index) => meal.title === larger.meals[index].title).length;
  assert.ok(sharedTitles < petite.meals.length * 0.4);
  const lunchTitles = petite.meals.filter(meal => meal.slot === 'Lunch').map(meal => meal.title);
  for (let index = 1; index < lunchTitles.length; index += 1) assert.notEqual(lunchTitles[index], lunchTitles[index - 1]);

  assertDietRules(petite, 'veg');
  assertDietRules(buildAdaptivePlan({ diet: 'vegan', goal: 'general' }), 'vegan');
  assertDietRules(buildAdaptivePlan({ diet: 'keto', goal: 'general' }), 'keto');
  const allergyPlan = buildAdaptivePlan({ diet: 'veg', goal: 'general', allergies: ['nuts', 'gluten'] });
  assertDietRules(allergyPlan, 'veg', ['nuts', 'gluten']);
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
    assert.ok(petite.meals.filter(meal => meal.day === day && meal.foodIds.includes('whey')).length <= 1);
  }
});

test('uses curated dishes and practical, bounded portions', () => {
  assert.ok(dishLibrary.length >= 80);
  for (const plan of [
    buildAdaptivePlan({ diet: 'veg', goal: 'general' }),
    buildAdaptivePlan({ diet: 'nonveg', goal: 'general' }),
    buildAdaptivePlan({ diet: 'vegan', goal: 'general' })
  ]) {
    const seenByDay = new Map();
    for (const meal of plan.meals) {
      assert.ok(meal.dishId);
      assert.equal(meal.dishIds.length, 1);
      assert.ok(meal.title);
      assert.ok(meal.prepNotes);
      for (const item of meal.items) {
        assert.doesNotMatch(item, /\b\d+\.\d{3,}\b/);
        assert.doesNotMatch(item, /\b[0-4] g\b/i);
      }
      for (const scaled of meal.dishScales) {
        assert.ok(scaled.scale >= scaled.scaleMin && scaled.scale <= scaled.scaleMax);
      }
      const history = seenByDay.get(meal.dishId) || [];
      assert.ok(history.every(dayIndex => PLAN_DAYS.indexOf(meal.day) - dayIndex >= 3));
      history.push(PLAN_DAYS.indexOf(meal.day));
      seenByDay.set(meal.dishId, history);
    }
    for (const day of PLAN_DAYS) {
      const lunch = plan.meals.find(meal => meal.day === day && meal.slot === 'Lunch');
      const dinner = plan.meals.find(meal => meal.day === day && meal.slot === 'Dinner');
      assert.notEqual(lunch.mainProtein, dinner.mainProtein);
    }
  }
  const nonKeto = buildAdaptivePlan({ diet: 'veg', goal: 'general' });
  assert.equal(nonKeto.meals.some(meal => meal.dishId.startsWith('keto-') || /cauliflower rice/i.test(meal.title)), false);
});

test('enforces weekly slot variety, dish metadata consistency, and natural units', () => {
  const profiles = {
    veg: { diet: 'veg', goal: 'general' },
    vegan: { diet: 'vegan', goal: 'general' },
    nonveg: { diet: 'nonveg', goal: 'musclegain' },
    keto: { diet: 'keto', goal: 'general' }
  };
  const keyIngredients = {
    paneer: ['paneer'], tofu: ['tofu'], chicken: ['chicken'], fish: ['fish', 'rohu'],
    egg: ['egg'], dal: ['dal', 'moong', 'masoor'], rajma: ['rajma'],
    chole: ['chickpea', 'chana'], chana: ['chickpea', 'chana'], soya: ['soya'],
    mushroom: ['mushroom'], salmon: ['salmon'], prawn: ['prawn'], turkey: ['turkey'],
    tempeh: ['tempeh'], edamame: ['edamame'], quinoa: ['quinoa'], poha: ['poha'],
    upma: ['upma'], idli: ['idli'], dosa: ['dosa'], oats: ['oat']
  };
  for (const [diet, input] of Object.entries(profiles)) {
    const plan = buildAdaptivePlan(input);
    const sets = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const dayMeals = plan.meals.filter(meal => meal.day === PLAN_DAYS[dayIndex]);
      sets.push(dayMeals.map(meal => meal.dishId).join('|'));
      for (const meal of dayMeals) {
        assert.equal(meal.dishIds.length, 1);
        assert.doesNotMatch(meal.items.join(' '), /\b\d+\.\d{3,}\b/);
        assert.doesNotMatch(meal.items.join(' '), /\b\d+ g (?:g|kg)\b/i);
        assert.ok(!meal.items.some(item => /\begg Whole egg\b|\btofu Firm tofu\b/i.test(item)));
      }
    }
    assert.equal(new Set(sets).size, 7, `${diet} has duplicate daily meal sets`);
    for (const slot of ['Breakfast', 'Lunch', 'Dinner', 'Snack']) {
      const poolSize = dishLibrary.filter(dish =>
        dish.diets.includes(diet) && dish.slots.includes(slot)).length;
      assert.ok(poolSize >= 8, `${diet} ${slot} pool has only ${poolSize} dishes`);
      const slotMeals = plan.meals.filter(meal => meal.slot === slot);
      const counts = new Map();
      for (const meal of slotMeals) counts.set(meal.dishId, (counts.get(meal.dishId) || 0) + 1);
      for (const [dishId, count] of counts) {
        assert.ok(poolSize >= 7 ? count === 1 : count <= 2, `${diet} ${slot} repeats ${dishId}`);
      }
    }
  }

  for (const dish of dishLibrary) {
    const componentText = dish.components.map(component => {
      const food = foodDatabase.find(candidate => candidate.id === component.foodId);
      return food?.name || component.foodId;
    }).join(' ').toLowerCase();
    for (const [key, aliases] of Object.entries(keyIngredients)) {
      if (dish.name.toLowerCase().includes(key)) {
        assert.ok(aliases.some(alias => componentText.includes(alias)), `${dish.id} title ingredient ${key} is missing`);
      }
    }
    if (dish.mainProtein) {
      const main = foodDatabase.find(food => food.id === dish.mainProtein);
      if (main) assert.match(componentText, new RegExp(main.name.split(' ')[0].toLowerCase()));
    }
  }
});

test('nonveg plans prioritize meat or fish mains without excessive fish', () => {
  const plan = buildAdaptivePlan({ diet: 'nonveg', goal: 'musclegain' });
  const mains = plan.meals.filter(meal => meal.slot === 'Lunch' || meal.slot === 'Dinner');
  const meat = mains.filter(meal => ['chicken', 'fish', 'mutton', 'prawns'].includes(meal.mainProtein));
  assert.ok(meat.filter(meal => meal.slot === 'Lunch').length >= 4);
  assert.ok(meat.filter(meal => meal.slot === 'Dinner').length >= 4);
  assert.ok(meat.filter(meal => meal.mainProtein === 'fish').length <= 3);
  for (let index = 2; index < mains.length; index += 1) {
    const previous = mains.slice(index - 2, index).every(meal =>
      ['chicken', 'fish', 'mutton', 'prawns'].includes(meal.mainProtein));
    assert.equal(previous && ['chicken', 'fish', 'mutton', 'prawns'].includes(mains[index].mainProtein), false);
  }
});

test('enforces curated add-ons and same-day keto and meal variety rules', () => {
  const keto = buildAdaptivePlan({ diet: 'keto', goal: 'general' });
  let weeklyCheeseMeals = 0;
  let weeklySalmonMeals = 0;
  for (const day of PLAN_DAYS) {
    const meals = keto.meals.filter(meal => meal.day === day);
    const cheeseMeals = meals.filter(meal => meal.foodIds.includes('cheese'));
    assert.ok(cheeseMeals.length <= 1);
    weeklyCheeseMeals += cheeseMeals.length;
    weeklySalmonMeals += meals.filter(meal => meal.foodIds.includes('salmon')).length;
    assert.equal(meals.some(meal =>
      meal.slot === 'Snack' && meal.foodIds.some(id => ['salmon', 'rohu', 'prawns'].includes(id))), false);
    const lunch = meals.find(meal => meal.slot === 'Lunch');
    const dinner = meals.find(meal => meal.slot === 'Dinner');
    const lunchDish = dishLibrary.find(dish => dish.id === lunch.dishId);
    const dinnerDish = dishLibrary.find(dish => dish.id === dinner.dishId);
    assert.notEqual(lunch.mainProtein, dinner.mainProtein);
    if (lunchDish.staple && dinnerDish.staple) assert.notEqual(lunchDish.staple, dinnerDish.staple);
    if (lunchDish.veg && dinnerDish.veg) assert.notEqual(lunchDish.veg, dinnerDish.veg);
    assert.notEqual(meals[0].mainProtein, meals[1].mainProtein);
  }
  assert.ok(weeklyCheeseMeals <= 3);
  assert.ok(weeklySalmonMeals <= 2);

  for (const dish of dishLibrary) {
    assert.ok(dish.addOns.length >= 1 && dish.addOns.length <= 3, `${dish.id} add-ons are not curated`);
    for (const addOn of dish.addOns) {
      const fruit = ['banana', 'apple', 'orange', 'berries', 'mango', 'papaya', 'guava', 'kiwi'].includes(addOn.foodId);
      if (fruit) assert.ok(dish.slots.includes('Breakfast') || dish.slots.includes('Snack'), `${dish.id} has a meal fruit add-on`);
    }
  }
});

test('is deterministic and applies the underweight fat-loss safety guard', () => {
  const input = {
    heightCm: 180, weightKg: 55, age: 28, gender: 'female',
    diet: 'veg', goal: 'fatloss', activityLevel: 'light'
  };
  assert.deepEqual(buildAdaptivePlan(input), buildAdaptivePlan(input));
  const underweight = buildAdaptivePlan(input);
  const maintenance = buildAdaptivePlan({ ...input, goal: 'general' });
  assert.equal(underweight.estimateMetadata.estimatedDailyKcal, maintenance.estimateMetadata.estimatedDailyKcal);
  assert.ok(underweight.safetyFlags.some(flag => /BMI|underweight|deficit/i.test(flag)));
  assert.ok(underweight.estimateMetadata.estimatedDailyKcal >= 1350);
  for (const label of ['BMI', 'TDEE', 'target', 'protein', 'carbs', 'fat']) {
    assert.match(underweight.explanation, new RegExp(label, 'i'));
  }
});

test('PATCH no eggs today changes only the matching day meal', async () => {
  const guest = await api('/api/session/guest', { method: 'POST', body: { displayName: 'Diet Test' } });
  const generated = await api('/api/plans/generate', {
    method: 'POST',
    token: guest.data.token,
    body: { heightCm: 175, weightKg: 74, age: 29, gender: 'male', diet: 'nonveg', goal: 'musclegain' }
  });
  assert.equal(generated.status, 201);
  const before = generated.data.plan;
  const patch = await api(`/api/plans/${generated.data.id}`, {
    method: 'PATCH',
    token: guest.data.token,
    body: { instruction: 'no eggs today', mealSlot: 'Breakfast', day: 'Wed' }
  });
  assert.equal(patch.status, 200);
  const beforeByKey = Object.fromEntries(before.meals.map(meal => [`${meal.day}:${meal.slot}`, JSON.stringify(meal)]));
  const afterByKey = Object.fromEntries(patch.data.plan.meals.map(meal => [`${meal.day}:${meal.slot}`, JSON.stringify(meal)]));
  const changed = Object.keys(beforeByKey).filter(key => beforeByKey[key] !== afterByKey[key]);
  assert.deepEqual(changed, ['Wed:Breakfast']);
  const replacement = patch.data.plan.meals.find(meal => meal.day === 'Wed' && meal.slot === 'Breakfast');
  assert.equal(replacement.contains.includes('eggs'), false);
  assert.doesNotMatch(replacement.items.join(' '), /\begg/i);
  assert.deepEqual(patch.data.plan.days, before.days);
});
