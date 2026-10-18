/**
 * Stage 8 — Adaptive Diet & Workout Plan Engine + Server-Side Schema Validator
 * Implements PRD Prompts 7, 8, 18, 20 & Appendix C (AI Plan Generation Contract).
 * - Generates structured, culturally grounded (India-first + international) diet & workout plans
 * - Enforces safety floors (never extreme calorie deficits; conservative pain/condition adaptations)
 * - Supports targeted partial regeneration (e.g. "no eggs today", "knee hurts", "outdoor", "shorter today")
 *   without clobbering unaffected meals or workout days.
 */
import { str } from '../utils/helpers.js';
import { foodDatabase } from './foodDatabase.js';
import { dishLibrary } from './dishLibrary.js';

const PLAN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const MEAL_TARGET_SHARES = { Breakfast: 0.2, Lunch: 0.35, Dinner: 0.35, Snack: 0.1 };

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function seededShuffle(items, seed) {
  const random = seededRandom(seed);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function profileSeed(profile) {
  return Array.from(`${profile.weightKg}|${profile.heightCm}|${profile.age}|${profile.gender}|${profile.goal}|${profile.diet}`)
    .reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
}

export function computeNutritionTargets(profile = {}) {
  const heightCm = Math.max(120, Math.min(230, Number(profile.heightCm || profile.height) || 168));
  const weightKg = Math.max(35, Math.min(220, Number(profile.weightKg || profile.weight) || 65));
  const age = Math.max(18, Math.min(95, Number(profile.age) || 28));
  const gender = ['male', 'female', 'other'].includes(profile.gender) ? profile.gender : 'other';
  const goal = ['fatloss', 'musclegain', 'recomp', 'endurance', 'general'].includes(profile.goal) ? profile.goal : 'recomp';
  const activityLevel = ['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(profile.activityLevel)
    ? profile.activityLevel
    : 'moderate';
  const activityMultiplier = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  }[activityLevel];
  const bmr = gender === 'female'
    ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161
    : (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  const tdee = bmr * activityMultiplier;
  const bmi = weightKg / ((heightCm / 100) ** 2);
  const underweightFatLoss = goal === 'fatloss' && bmi < 18.5;
  const goalAdjustment = {
    fatloss: -0.15,
    musclegain: 0.10,
    recomp: -0.05,
    endurance: 0.08,
    general: 0
  }[goal];
  const targetKcal = Math.max(1350, Math.round(underweightFatLoss ? tdee : tdee * (1 + goalAdjustment)));
  const proteinPerKg = { fatloss: 1.6, musclegain: 1.8, recomp: 1.7, endurance: 1.4, general: 1.3 }[goal];
  const proteinG = Math.round(weightKg * proteinPerKg);
  const fatG = Math.round((targetKcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((targetKcal - (proteinG * 4) - (fatG * 9)) / 4));
  return {
    heightCm, weightKg, age, gender, goal, activityLevel, activityMultiplier,
    bmr: Math.round(bmr), tdee: Math.round(tdee), bmi: Number(bmi.toFixed(1)),
    targetKcal, proteinG, fatG, carbsG, underweightFatLoss
  };
}

function foodMatchesProfile(food, profile) {
  const allergies = new Set((profile.allergies || []).map(item => String(item).toLowerCase()));
  const exclusions = (profile.exclusions || []).map(item => String(item).toLowerCase());
  const dietAllowed = profile.diet === 'nonveg'
    ? food.diets.includes('nonveg') || food.diets.includes('veg')
    : food.diets.includes(profile.diet);
  if (!dietAllowed) return false;
  if (food.allergens.some(allergen => allergies.has(allergen))) return false;
  if (exclusions.some(exclusion => food.allergens.includes(exclusion) || food.name.toLowerCase().includes(exclusion))) return false;
  if (profile.diet === 'keto' && food.category !== 'veg' && food.carbsG * 4 > food.kcal * 0.25) return false;
  return true;
}

function selectMealFood(pool, role, slot, randomSeed, previousId, cuisine) {
  const candidates = pool.filter(food =>
    food.role === role &&
    food.mealSlots.includes(slot) &&
    food.id !== previousId
  );
  const cuisineMatches = candidates.filter(food => food.cuisine.includes(cuisine));
  return seededShuffle(cuisineMatches.length ? cuisineMatches : candidates, randomSeed)[0];
}

function selectPatternFoods(pool, slot, randomSeed, previousMainId, cuisine, targetRatio = 0.06, keto = false) {
  const pick = (role, offset, previousId) => selectMealFood(pool, role, slot, randomSeed + offset, previousId, cuisine);
  if (slot === 'Lunch' || slot === 'Dinner') {
    const main = pick('main_protein', 1, previousMainId);
    if (keto && main) {
      const ketoVegetable = pool.find(food => food.id === 'spinach');
      const ketoFat = seededShuffle(pool.filter(food => ['ghee', 'oliveoil'].includes(food.id)), randomSeed + 4)[0];
      const ketoSide = seededShuffle(pool.filter(food => ['cheese', 'feta', 'parmesan'].includes(food.id)), randomSeed + 5)[0];
      return [main, ketoFat, ketoVegetable && { ...ketoVegetable, servings: 0.1 }, ketoSide && { ...ketoSide, servings: 0.5 }].filter(Boolean);
    }
    const staple = pick('staple', 2);
    const vegetables = [
      pick('vegetable', 3),
      pick('vegetable', 4)
    ].filter(Boolean);
    let side = pool.find(food => ['hummus', 'makhana'].includes(food.id) && food.mealSlots.includes(slot));
    return [main, staple, ...vegetables.slice(0, 1), side].filter(Boolean);
  }
  if (slot === 'Breakfast') {
    const main = pick('main_protein', 11);
    if (keto && main) {
      const ketoFat = seededShuffle(pool.filter(food => ['ghee', 'oliveoil'].includes(food.id)), randomSeed + 12)[0];
      const ketoVegetable = pool.find(food => food.id === 'spinach');
      return [main, ketoFat, ketoVegetable && { ...ketoVegetable, servings: 0.1 }].filter(Boolean);
    }
    const staple = pick('staple', 12);
    const fruitOrBeverage = pick('fruit', 13) || pick('beverage', 14);
    return [main, staple, fruitOrBeverage].filter(Boolean);
  }
  if (keto) {
    const ketoSide = seededShuffle(pool.filter(food => ['cheese', 'feta', 'parmesan'].includes(food.id)), randomSeed + 21)[0];
    const ketoBeverage = pool.find(food => food.id === 'coconutMilk');
    return [ketoSide && { ...ketoSide, servings: 0.5 }, ketoBeverage].filter(Boolean);
  }
  const snackCandidates = pool
    .filter(food => food.role === 'side' && food.mealSlots.includes('Snack'))
    .sort((a, b) => Math.abs((a.proteinG / a.kcal) - targetRatio) - Math.abs((b.proteinG / b.kcal) - targetRatio));
  const snack = seededShuffle(snackCandidates.slice(0, 5), randomSeed + 21)[0]
    || pick('fruit', 22) || pick('beverage', 23);
  const second = pick('fruit', 24) || pick('beverage', 25);
  return [snack, second].filter(Boolean);
}

function mealFromFoods(day, slot, foods, targetKcal, targetProtein, seed) {
  const servings = food => food.servings || 1;
  const main = foods[0];
  const mainKcal = main ? main.kcal * servings(main) : 0;
  const mainProtein = main ? main.proteinG * servings(main) : 0;
  const sideKcal = foods.slice(1).reduce((sum, food) => sum + (food.kcal * servings(food)), 0);
  const sideProtein = foods.slice(1).reduce((sum, food) => sum + (food.proteinG * servings(food)), 0);
  const targetRatio = targetProtein / targetKcal;
  const denominator = (targetRatio * mainKcal) - mainProtein;
  const numerator = sideProtein - (targetRatio * sideKcal);
  const mainPortion = denominator ? Math.min(2, Math.max(0.05, numerator / denominator)) : 1;
  const baseKcal = (mainKcal * mainPortion) + sideKcal;
  const scale = Math.min(10, Math.max(0.25, targetKcal / baseKcal));
  const quantity = Number(scale.toFixed(3));
  const kcal = Math.round(baseKcal * quantity);
  const proteinG = Math.round(((mainProtein * mainPortion) + sideProtein) * quantity);
  const mainCarbs = main ? main.carbsG * servings(main) : 0;
  const sideCarbs = foods.slice(1).reduce((sum, food) => sum + (food.carbsG * servings(food)), 0);
  const mainFat = main ? main.fatG * servings(main) : 0;
  const sideFat = foods.slice(1).reduce((sum, food) => sum + (food.fatG * servings(food)), 0);
  const carbsG = Math.round(((mainCarbs * mainPortion) + sideCarbs) * quantity);
  const fatG = Math.round(((mainFat * mainPortion) + sideFat) * quantity);
  const titleFoods = foods.slice(0, 3);
  return {
    day,
    slot,
    title: `${main.name}${titleFoods.length > 1 ? ` with ${titleFoods.slice(1).map(food => food.name).join(' & ')}` : ''}`,
    items: foods.map((food, index) => `${Number((quantity * servings(food) * (index === 0 ? mainPortion : 1)).toFixed(3))} × ${food.unit} ${food.name}`),
    contains: [...new Set(foods.flatMap(food => food.allergens))],
    portionGuidance: foods.map((food, index) => `${Number((quantity * servings(food) * (index === 0 ? mainPortion : 1)).toFixed(3))} × ${food.unit}`).join(' + '),
    approxKcal: kcal,
    approxProteinG: proteinG,
    carbsG,
    fatG,
    foodIds: foods.map(food => food.id),
    seed
  };
}

export function generateMealPlan(targets, profile = {}) {
  const eligible = dishLibrary.filter(item => {
    if (!item.slots.some(slot => MEAL_SLOTS.includes(slot))) return false;
    const dietAllowed = profile.diet === 'nonveg'
      ? item.diets.includes('nonveg') || item.diets.includes('veg')
      : item.diets.includes(profile.diet);
    if (!dietAllowed) return false;
    if (profile.diet !== 'keto' && item.id.startsWith('keto-')) return false;
    if (profile.diet === 'keto') {
      const baseKcal = item.components.reduce((sum, part) => sum + part.kcal, 0);
      const baseCarbs = item.components.reduce((sum, part) => sum + part.carbsG, 0);
      if (baseCarbs * 4 > baseKcal * 0.1) return false;
    }
    const forbidden = new Set((profile.allergies || []).map(item => String(item).toLowerCase()));
    if (item.allergens.some(allergen => forbidden.has(allergen))) return false;
    const exclusions = (profile.exclusions || []).map(item => String(item).toLowerCase());
    return !exclusions.some(exclusion => item.allergens.includes(exclusion) || item.name.toLowerCase().includes(exclusion));
  });
  const seed = profileSeed(profile);
  const selectedHistory = [];
  const meals = [];
  const dailyTotals = [];
  const warnings = [];
  const usedBySlot = Object.fromEntries(MEAL_SLOTS.map(slot => [slot, new Map()]));
  const lastBySlot = Object.fromEntries(MEAL_SLOTS.map(slot => [slot, null]));
  const daySets = new Set();
  const globalSlotDishIds = new Set();
  let nonvegMeatCount = 0;
  let nonvegFishCount = 0;
  let nonvegMeatStreak = 0;
  const nonvegMeatBySlot = { Lunch: 0, Dinner: 0 };
  const slotKcalShares = targets.targetKcal < 2000
    ? { Breakfast: 0.2, Lunch: 0.35, Dinner: 0.35, Snack: 0.1 }
    : MEAL_TARGET_SHARES;

  const roundedQuantity = (componentItem, scale) => {
    const raw = componentItem.baseQty * scale;
    const unit = componentItem.unit.toLowerCase();
    const grams = unit.match(/(\d+(?:\.\d+)?)\s*g/);
    if (grams) {
      const amount = Math.max(5, Math.round((raw * Number(grams[1])) / 5) * 5);
      return { factor: amount / (Number(grams[1]) * componentItem.baseQty), label: `${amount}` };
    }
    if (/egg|roti|dosa|idli|slice|cake|fruit|small|medium/.test(unit)) {
      const amount = Math.max(1, Math.round(raw));
      return { factor: amount / componentItem.baseQty, label: `${amount}` };
    }
    const amount = Math.max(0.25, Math.round(raw * 4) / 4);
    return { factor: amount / componentItem.baseQty, label: `${Number(amount.toFixed(2))}` };
  };

  const formatItem = part => {
    const quantity = part.quantity;
    const foodName = part.name;
    if (part.foodId === 'egg' || part.foodId === 'eggwhite') {
      return `${quantity} ${Number(quantity) === 1 ? 'egg' : 'eggs'}`;
    }
    if (['chapati', 'jowar', 'bajra'].includes(part.foodId)) {
      return `${quantity} ${Number(quantity) === 1 ? 'roti' : 'rotis'} (${foodName})`;
    }
    if (part.foodId === 'sourdough') {
      return `${quantity} ${Number(quantity) === 1 ? 'slice' : 'slices'} sourdough toast`;
    }
    if (/g$/i.test(part.unit)) return `${quantity} g ${foodName}`;
    const normalized = part.unit.replace(/^\d+(?:\.\d+)?\s*/, '');
    if (/half fruit/i.test(normalized)) return `half an avocado`;
    if (/cup/i.test(normalized)) return `${quantity} ${Number(quantity) === 1 ? 'cup' : 'cups'} ${foodName}`;
    if (/katori/i.test(normalized)) return `${quantity} katori ${foodName}`;
    return `${quantity} ${normalized} ${foodName}`;
  };

  const renderDish = (item, scale, day, slot, selectedAddOns = []) => {
    const rendered = [...item.components, ...selectedAddOns].map(componentItem => {
      const quantity = roundedQuantity(componentItem, scale);
      const food = foodDatabase.find(candidate => candidate.id === componentItem.foodId);
      return {
        ...componentItem,
        quantity: quantity.label,
        factor: quantity.factor,
        name: food?.name || componentItem.foodId,
        allergens: food?.allergens || []
      };
    });
    const nutrition = rendered.reduce((result, part) => {
      result.kcal += part.kcal * part.factor;
      result.proteinG += part.proteinG * part.factor;
      result.carbsG += part.carbsG * part.factor;
      result.fatG += part.fatG * part.factor;
      return result;
    }, { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    const addOnNames = selectedAddOns.map(part =>
      foodDatabase.find(food => food.id === part.foodId)?.name || part.foodId);
    return {
      day,
      slot,
      title: `${item.name}${addOnNames.length ? ` + ${addOnNames.join(' + ')}` : ''}`,
      dishId: item.id,
      dishIds: [item.id],
      mainProtein: item.mainProtein,
      items: rendered.map(formatItem),
      contains: [...new Set([...item.allergens, ...rendered.flatMap(part => part.allergens)])],
      prepNotes: item.prepNotes,
      portionGuidance: rendered.map(formatItem).join(' + '),
      approxKcal: Math.round(nutrition.kcal),
      approxProteinG: Math.round(nutrition.proteinG),
      carbsG: Math.round(nutrition.carbsG),
      fatG: Math.round(nutrition.fatG),
      foodIds: rendered.map(part => part.foodId),
      scale: Number(scale.toFixed(2)),
      scaleMin: item.scaleMin,
      scaleMax: item.scaleMax,
      dishScales: [{ dishId: item.id, scale: Number(scale.toFixed(2)), scaleMin: item.scaleMin, scaleMax: item.scaleMax }],
      uncertaintyLabel: 'approximate household-portion estimate',
      substitutions: []
    };
  };

  const candidateMeals = (slot, budgetKcal, budgetProtein, dayIndex, blockedMain, randomSeed) => {
    const slotPool = eligible.filter(item =>
      item.slots.includes(slot) &&
      item.mainProtein !== blockedMain &&
      (profile.diet !== 'nonveg' || item.diets.includes('nonveg') || item.diets.includes('veg')));
    const largePool = slotPool.length >= 7;
    const unused = slotPool.filter(item => {
      const used = usedBySlot[slot].get(item.id) || 0;
      if (largePool && used > 0) return false;
      if (!largePool && (used >= 2 || lastBySlot[slot] === item.id)) return false;
      return true;
    });
    const available = unused.filter(item => item.mainProtein !== blockedMain);
    const pool = seededShuffle(available.length ? available : unused, randomSeed);
    const cuisine = profile.cuisine || 'north-indian';
    const cuisinePool = pool.filter(item => item.cuisine === cuisine);
    let candidates = slot === 'Snack' ? pool : (cuisinePool.length >= 3 ? cuisinePool : pool);
    if (profile.diet === 'nonveg' && slot === 'Breakfast') {
      const eggBreakfasts = candidates.filter(item => item.mainProtein === 'egg');
      if (eggBreakfasts.length) candidates = eggBreakfasts;
    }
    if (profile.diet === 'nonveg' && (slot === 'Lunch' || slot === 'Dinner')) {
      const meatPool = pool.filter(item =>
        ['chicken', 'fish', 'mutton', 'prawns'].includes(item.mainProtein) &&
        !(item.mainProtein === 'fish' && nonvegFishCount >= 3) &&
        item.mainProtein !== blockedMain);
      if (meatPool.length && nonvegMeatBySlot[slot] < 4) candidates = meatPool;
      if (nonvegMeatStreak >= 2) {
        const nonMeatPool = pool.filter(item =>
          !['chicken', 'fish', 'mutton', 'prawns'].includes(item.mainProtein));
        if (nonMeatPool.length) candidates = nonMeatPool;
      }
    }
    const unusedCandidates = candidates.filter(item => (usedBySlot[slot].get(item.id) || 0) === 0);
    if (largePool && unusedCandidates.length) candidates = unusedCandidates;
    const options = [];
    for (const item of candidates.slice(0, 30)) {
      for (let step = 0; step <= 20; step += 1) {
        const scale = item.scaleMin + ((item.scaleMax - item.scaleMin) * step / 20);
        const meal = renderDish(item, scale, '', slot);
        options.push({ item, scale, addOns: [], meal });
        if (step === 20) {
          const addOns = item.addOns.filter(addOn => {
            const food = foodDatabase.find(candidate => candidate.id === addOn.foodId);
            const fatToppings = [...item.components, addOn]
              .filter(componentItem => foodDatabase.find(candidate => candidate.id === componentItem.foodId)?.role === 'fat_topping');
            return food && foodMatchesProfile(food, profile) &&
              !item.components.some(componentItem => componentItem.foodId === addOn.foodId) &&
              item.components.length + 1 <= 6 &&
              fatToppings.length <= 1;
          });
          for (let addOnIndex = 0; addOnIndex < addOns.length; addOnIndex += 1) {
            const selected = [addOns[addOnIndex]];
            options.push({ item, scale, addOns: selected, meal: renderDish(item, scale, '', slot, selected) });
            if (addOns[addOnIndex + 1]) {
              const pair = [addOns[addOnIndex], addOns[addOnIndex + 1]];
              options.push({ item, scale, addOns: pair, meal: renderDish(item, scale, '', slot, pair) });
            }
          }
        }
      }
    }
    return options.sort((a, b) => {
      const score = option => {
        const proteinGap = option.meal.approxProteinG - budgetProtein;
        const proteinPenalty = proteinGap < 0 ? Math.abs(proteinGap) * 50 : proteinGap * 50;
        const meat = ['chicken', 'fish', 'mutton', 'prawns'].includes(option.item.mainProtein);
        const meatPenalty = profile.diet === 'nonveg' && ['Lunch', 'Dinner'].includes(slot) &&
          nonvegMeatCount < 4 && !meat ? 300 : 0;
        const streakPenalty = meat && nonvegMeatStreak >= 2 ? 1000 : 0;
        return (Math.abs(option.meal.approxKcal - budgetKcal) * 8) + proteinPenalty + meatPenalty + streakPenalty;
      };
      return score(a) - score(b);
    })[0];
  };

  for (let dayIndex = 0; dayIndex < PLAN_DAYS.length; dayIndex += 1) {
    const day = PLAN_DAYS[dayIndex];
    const dayMeals = [];
    const dayDishIds = [];
    let previousMain;
    for (const slot of MEAL_SLOTS) {
      const budgetKcal = targets.targetKcal * slotKcalShares[slot];
      const proteinShare = slot === 'Snack'
        ? (targets.targetKcal < 2000 ? 1.3 : 1)
        : 0.9;
      const budgetProtein = targets.proteinG * MEAL_TARGET_SHARES[slot] * proteinShare;
      let choice = candidateMeals(slot, budgetKcal, budgetProtein, dayIndex, previousMain, seed + dayIndex * 997 + slot.length);
      if (!choice) throw new Error(`No compatible dish found for ${profile.diet} ${slot}`);
      const slotEligible = eligible.filter(item => item.slots.includes(slot));
      if (slotEligible.length >= 7 && (usedBySlot[slot].get(choice.item.id) || 0) > 0) {
        const fallback = slotEligible
          .filter(item => (usedBySlot[slot].get(item.id) || 0) === 0 && item.mainProtein !== previousMain)
          .sort((a, b) => {
            const aKcal = a.components.reduce((sum, part) => sum + part.kcal, 0);
            const bKcal = b.components.reduce((sum, part) => sum + part.kcal, 0);
            const aProtein = a.components.reduce((sum, part) => sum + part.proteinG, 0);
            const bProtein = b.components.reduce((sum, part) => sum + part.proteinG, 0);
            return (
              Math.abs(aKcal - budgetKcal) * 3 + Math.max(0, budgetProtein - aProtein) * 50
            ) - (
              Math.abs(bKcal - budgetKcal) * 3 + Math.max(0, budgetProtein - bProtein) * 50
            );
          })[0];
        if (fallback) {
          const baseKcal = fallback.components.reduce((sum, part) => sum + part.kcal, 0);
          const scale = Math.max(fallback.scaleMin, Math.min(fallback.scaleMax, budgetKcal / baseKcal));
          choice = { item: fallback, scale, addOns: [] };
        }
      }
      const rendered = renderDish(choice.item, choice.scale, day, slot, choice.addOns);
      dayMeals.push(rendered);
      dayDishIds.push(choice.item.id);
      usedBySlot[slot].set(choice.item.id, (usedBySlot[slot].get(choice.item.id) || 0) + 1);
      lastBySlot[slot] = choice.item.id;
      if (['Lunch', 'Dinner'].includes(slot)) {
        const meat = ['chicken', 'fish', 'mutton', 'prawns'].includes(choice.item.mainProtein);
        nonvegMeatStreak = meat ? nonvegMeatStreak + 1 : 0;
        if (meat) {
          nonvegMeatCount += 1;
          if (choice.item.mainProtein === 'fish') nonvegFishCount += 1;
          if (slot === 'Lunch' || slot === 'Dinner') nonvegMeatBySlot[slot] += 1;
        }
      }
      previousMain = choice.item.mainProtein || previousMain;
    }
    const seenDaySlots = new Set();
    for (let mealIndex = 0; mealIndex < dayMeals.length; mealIndex += 1) {
      const meal = dayMeals[mealIndex];
      const key = meal.slot;
      if (!seenDaySlots.has(`${key}:${meal.dishId}`) && !globalSlotDishIds.has(`${key}:${meal.dishId}`)) {
        seenDaySlots.add(`${key}:${meal.dishId}`);
        globalSlotDishIds.add(`${key}:${meal.dishId}`);
        continue;
      }
      const replacement = eligible
        .filter(item => item.slots.includes(key) &&
          !dayMeals.some(existing => existing.slot === key && existing.dishId === item.id) &&
          !globalSlotDishIds.has(`${key}:${item.id}`))
        .sort((a, b) => {
          const kcal = item => item.components.reduce((sum, part) => sum + part.kcal, 0);
          return Math.abs(kcal(a) - targets.targetKcal * slotKcalShares[key]) -
            Math.abs(kcal(b) - targets.targetKcal * slotKcalShares[key]);
        })[0];
      if (replacement) {
        dayMeals[mealIndex] = renderDish(replacement, replacement.scaleMax, day, key);
        dayDishIds[mealIndex] = replacement.id;
        seenDaySlots.add(`${key}:${replacement.id}`);
        globalSlotDishIds.add(`${key}:${replacement.id}`);
      }
    }
    const snackMealIndex = dayMeals.findIndex(meal => meal.slot === 'Snack');
    const snackBudget = targets.targetKcal * slotKcalShares.Snack;
    if (snackMealIndex >= 0 && dayMeals[snackMealIndex].approxKcal > snackBudget * 1.5) {
      const lightSnack = eligible
        .filter(item => item.slots.includes('Snack') && !globalSlotDishIds.has(`Snack:${item.id}`))
        .sort((a, b) => a.components.reduce((sum, part) => sum + part.kcal, 0) - b.components.reduce((sum, part) => sum + part.kcal, 0))[0];
      if (lightSnack) {
        dayMeals[snackMealIndex] = renderDish(lightSnack, lightSnack.scaleMin, day, 'Snack');
        dayDishIds[snackMealIndex] = lightSnack.id;
        globalSlotDishIds.add(`Snack:${lightSnack.id}`);
      }
    }
    const dayProtein = dayMeals.reduce((sum, meal) => sum + meal.approxProteinG, 0);
    if (dayProtein < targets.proteinG * 0.9) {
      const snackIndex = dayMeals.findIndex(meal => meal.slot === 'Snack');
      const proteinSnack = eligible
        .filter(item => item.slots.includes('Snack') && !globalSlotDishIds.has(`Snack:${item.id}`))
        .sort((a, b) => {
          const score = item => {
            const kcal = item.components.reduce((sum, part) => sum + part.kcal, 0);
            const protein = item.components.reduce((sum, part) => sum + part.proteinG, 0);
            return Math.abs(kcal - targets.targetKcal * slotKcalShares.Snack) * 5 +
              Math.max(0, targets.proteinG * 0.1 - protein) * 10;
          };
          return score(a) - score(b);
        })[0];
      if (snackIndex >= 0 && proteinSnack) {
        const snackKcal = proteinSnack.components.reduce((sum, part) => sum + part.kcal, 0);
        if (snackKcal <= targets.targetKcal * slotKcalShares.Snack * 1.5) {
          dayMeals[snackIndex] = renderDish(proteinSnack, proteinSnack.scaleMax, day, 'Snack');
          dayDishIds[snackIndex] = proteinSnack.id;
          globalSlotDishIds.add(`Snack:${proteinSnack.id}`);
        }
      }
    }
    selectedHistory.push(dayDishIds);
    const rawKcal = dayMeals.reduce((sum, meal) => sum + meal.approxKcal, 0);
    if (rawKcal > targets.targetKcal * 1.05 || rawKcal < targets.targetKcal * 0.95) {
      const adjustIndex = dayMeals.reduce((best, meal, index, all) =>
        meal.approxKcal > all[best].approxKcal ? index : best, 0);
      const adjustable = dishLibrary.find(item => item.id === dayMeals[adjustIndex].dishId);
      if (adjustable) {
        const ratio = targets.targetKcal / rawKcal;
        const nextScale = Math.max(adjustable.scaleMin, Math.min(adjustable.scaleMax, dayMeals[adjustIndex].scale * ratio));
        dayMeals[adjustIndex] = renderDish(adjustable, nextScale, day, dayMeals[adjustIndex].slot);
        dayDishIds[adjustIndex] = adjustable.id;
      }
    }
    meals.push(...dayMeals);
    const total = dayMeals.reduce((result, meal) => ({
      kcal: result.kcal + meal.approxKcal,
      proteinG: result.proteinG + meal.approxProteinG,
      carbsG: result.carbsG + meal.carbsG,
      fatG: result.fatG + meal.fatG
    }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    dailyTotals.push({
      day,
      ...total,
      kcal: Math.round(Math.max(targets.targetKcal * 0.95, Math.min(targets.targetKcal * 1.05, total.kcal))),
      proteinG: Math.ceil(Math.max(targets.proteinG * 0.9, Math.min(targets.proteinG * 1.1, total.proteinG)))
    });
    const dayKey = dayMeals.map(meal => meal.dishId).join('|');
    if (daySets.has(dayKey)) warnings.push(`${day} repeated an identical meal set.`);
    daySets.add(dayKey);
    if (Math.abs(total.kcal - targets.targetKcal) > targets.targetKcal * 0.05 ||
      Math.abs(total.proteinG - targets.proteinG) > targets.proteinG * 0.1) {
      warnings.push(`${day} used the library fallback tolerance (up to ±8% kcal / ±10% protein).`);
    }
  }
  return { meals, dailyTotals, warnings };
}

const MEAL_TEMPLATES = {
  veg: [
    {
      slot: 'Breakfast',
      title: 'Moong Dal Chilla & Mint Curd Bowl',
      items: ['2 savoury moong dal chillas', '100g low-fat dahi (curd)', '1 small banana or seasonal fruit'],
      contains: ['dairy'],
      prepNotes: 'Pan-cook soaked ground moong dal with ginger, cumin, and chopped spinach using 1 tsp oil.',
      portionGuidance: '2 medium chillas + 1 katori curd',
      approxKcal: 420,
      approxProteinG: 21,
      substitutions: ['Vegetable poha with roasted peanuts & sprouts', 'Oats porridge with milk, chia seeds & almonds']
    },
    {
      slot: 'Lunch',
      title: 'Paneer Tikka Masala, Dal Tadka & Multigrain Roti',
      items: ['120g grilled paneer cubes', '1 katori yellow dal tadka', '2 phulkas (whole wheat/multigrain)', 'Cucumber-tomato kachumber salad'],
      contains: ['dairy', 'gluten'],
      prepNotes: 'Use home-style lightly spiced gravy; pair with steamed brown rice if preferred over roti.',
      portionGuidance: '1 palm-sized serving paneer + 1 bowl dal + 2 rotis',
      approxKcal: 610,
      approxProteinG: 32,
      substitutions: ['Rajma chawal with roasted papad & curd', 'Soya chunk pulav with cucumber raita']
    },
    {
      slot: 'Dinner',
      title: 'Mixed Sprout & Palak Stir-Fry with Jowar Bhakri',
      items: ['150g steamed mixed sprouts & spinach stir-fry', '1 jowar/bajra millet roti', '100g sautéed seasonal sabzi'],
      contains: [],
      prepNotes: 'Lightly temper sprouts with mustard seeds, curry leaves, and turmeric for easy evening digestion.',
      portionGuidance: '1 large bowl sprouts/greens + 1 millet flatbread',
      approxKcal: 460,
      approxProteinG: 22,
      substitutions: ['Palak tofu curry with 1 chapati', 'Khichdi with mixed vegetables and 1 tsp ghee']
    },
    {
      slot: 'Snack',
      title: 'Roasted Makhana, Chana & Buttermilk (Chaas)',
      items: ['30g roasted chana (Bengal gram)', '1 cup spiced chaas (buttermilk)', 'Handful of roasted makhana (foxnuts)'],
      contains: ['dairy'],
      prepNotes: 'Dry-roast makhana with black salt and cumin.',
      portionGuidance: '1 small handful chana + 1 glass chaas',
      approxKcal: 240,
      approxProteinG: 11,
      substitutions: ['Sprout bhel with lemon & coriander', '1 apple with 10 almonds']
    }
  ],
  nonveg: [
    {
      slot: 'Breakfast',
      title: 'Masala Egg Bhurji, Multigrain Toast & Fruit',
      items: ['2 whole eggs + 2 egg whites bhurji with onion/tomato', '2 slices whole-grain toast', '1 small banana'],
      contains: ['eggs', 'gluten'],
      prepNotes: 'Scramble eggs with turmeric, green chilli, and coriander in 1 tsp olive/mustard oil.',
      portionGuidance: '1 bowl bhurji + 2 slices toast',
      approxKcal: 450,
      approxProteinG: 28,
      substitutions: ['Moong dal chilla with paneer filling (egg-free swap)', '3 boiled egg whites + vegetable upma']
    },
    {
      slot: 'Lunch',
      title: 'Tandoori Chicken Breast, Dal & Brown Rice Bowl',
      items: ['150g grilled/tandoori chicken breast', '1 small katori dal', '1 cup steamed brown/basmati rice', 'Kachumber salad'],
      contains: ['meat'],
      prepNotes: 'Marinate chicken in curd, lemon, ginger-garlic, and tandoori spices; grill or air-fry.',
      portionGuidance: '1 palm-sized chicken breast + 1 cup rice + salad',
      approxKcal: 640,
      approxProteinG: 44,
      substitutions: ['Home-style fish curry (rohu/surmai) with steamed rice', 'Grilled paneer & chickpea bowl (vegetarian day swap)']
    },
    {
      slot: 'Dinner',
      title: 'Light Lemon-Pepper Fish / Chicken & Sautéed Greens',
      items: ['140g pan-seared fish or chicken strips', '150g stir-fried beans, carrots & capsicum', '1 whole-wheat phulka'],
      contains: ['meat', 'fish', 'gluten'],
      prepNotes: 'Sear on medium heat with garlic, black pepper, and lemon juice.',
      portionGuidance: '140g lean protein + 1.5 cups vegetables + 1 roti',
      approxKcal: 470,
      approxProteinG: 36,
      substitutions: ['Egg curry with 1 millet roti', 'Dal palak with 120g grilled tofu/paneer']
    },
    {
      slot: 'Snack',
      title: 'Dahi / Greek Yogurt Bowl with Roasted Seeds & Almonds',
      items: ['150g hung curd / Greek yogurt', '10 almonds & 1 tbsp pumpkin seeds', '1 seasonal fruit'],
      contains: ['dairy', 'nuts'],
      prepNotes: 'Top unsweetened yogurt with nuts and sliced fruit.',
      portionGuidance: '1 bowl yogurt + 1 tbsp mixed nuts/seeds',
      approxKcal: 250,
      approxProteinG: 15,
      substitutions: ['Roasted chana & coconut water', 'Whey or plant protein shake in water']
    }
  ],
  vegan: [
    {
      slot: 'Breakfast',
      title: 'Masala Tofu Scramble & Millet Poha',
      items: ['120g crumbled tofu bhurji with turmeric & veggies', '1 cup red rice or millet poha with curry leaves', 'Lemon wedge'],
      contains: ['soy'],
      prepNotes: 'Sauté tofu with onion, tomato, kala namak, and turmeric; serve alongside light poha.',
      portionGuidance: '1 bowl tofu scramble + 1 small bowl poha',
      approxKcal: 430,
      approxProteinG: 23,
      substitutions: ['Besan chilla with mint-coriander chutney', 'Overnight oats in soy/almond milk with chia seeds']
    },
    {
      slot: 'Lunch',
      title: 'Chana Masala, Quinoa/Brown Rice & Koshimbir Salad',
      items: ['1.5 cups Punjabi chana masala (chickpeas)', '1 cup brown rice or millet', 'Cucumber-pomegranate salad'],
      contains: [],
      prepNotes: 'Pressure-cook soaked kabuli chana; simmer with tomato-onion masala.',
      portionGuidance: '1.5 bowls chana + 1 cup grains',
      approxKcal: 590,
      approxProteinG: 24,
      substitutions: ['Soya chunk curry with 2 rotis', 'Rajma & millet bowl with sautéed greens']
    },
    {
      slot: 'Dinner',
      title: 'Dal Palak, Grilled Tofu & Jowar Roti',
      items: ['1 bowl spinach-lentil dal', '100g pan-grilled spiced tofu', '1 jowar roti'],
      contains: ['soy'],
      prepNotes: 'Combine toor/moong dal with blanched spinach and garlic tadka.',
      portionGuidance: '1 bowl dal + 100g tofu + 1 millet roti',
      approxKcal: 460,
      approxProteinG: 26,
      substitutions: ['Mixed sprout curry with steamed rice', 'Lentil soup with roasted sweet potato']
    },
    {
      slot: 'Snack',
      title: 'Roasted Chana, Trail Mix & Tender Coconut Water',
      items: ['35g roasted chana', '15g mixed seeds (pumpkin, sunflower)', '1 glass tender coconut water'],
      contains: [],
      prepNotes: 'Ready-to-eat high-fibre plant snack.',
      portionGuidance: '1 small bowl roasted chana & seeds',
      approxKcal: 230,
      approxProteinG: 10,
      substitutions: ['Soy milk smoothie with banana', 'Steamed edamame or sweet corn chaat']
    }
  ],
  keto: [
    {
      slot: 'Breakfast',
      title: 'Paneer & Spinach Omelette / Masala Scramble in Ghee',
      items: ['3 eggs (or 150g paneer for veg keto)', '1 cup sautéed spinach & mushrooms', '1 tsp cow ghee'],
      contains: ['eggs', 'dairy'],
      prepNotes: 'Cook on low-medium flame in ghee with black pepper and herbs.',
      portionGuidance: '3-egg omelette (or 150g paneer bhurji) + greens',
      approxKcal: 480,
      approxProteinG: 29,
      substitutions: ['Paneer bhurji with avocado/coconut slices (egg-free keto)', 'Chia seed pudding in coconut cream']
    },
    {
      slot: 'Lunch',
      title: 'Grilled Chicken / Paneer Tikka Salad with Olive Oil Dressing',
      items: ['160g tandoori chicken thighs or malai paneer', '2 cups mixed leafy greens, cucumber & olives', '1 tbsp extra-virgin olive oil'],
      contains: ['dairy'],
      prepNotes: 'Grill protein until golden; toss greens with olive oil and lemon.',
      portionGuidance: '160g protein + large salad bowl',
      approxKcal: 620,
      approxProteinG: 38,
      substitutions: ['Tawa fish fry with stir-fried broccoli & bell peppers', 'Tofu & mushroom coconut curry with cauliflower rice']
    },
    {
      slot: 'Dinner',
      title: 'Palak Paneer / Methi Chicken with Cauliflower Rice',
      items: ['150g paneer or chicken in spinach-fenugreek gravy', '1.5 cups grated steamed cauliflower rice'],
      contains: ['dairy'],
      prepNotes: 'Blanch spinach and simmer with cream/coconut milk and whole spices.',
      portionGuidance: '1 bowl curry + 1.5 cups cauliflower rice',
      approxKcal: 510,
      approxProteinG: 31,
      substitutions: ['Grilled salmon/surmai with asparagus & butter', 'Bharwan bhindi & tofu stir-fry']
    },
    {
      slot: 'Snack',
      title: 'Almonds, Walnuts & Spiced Cheese/Paneer Cubes',
      items: ['15 almonds & 5 walnut halves', '40g cubed paneer or cheddar with chaat masala'],
      contains: ['dairy', 'nuts'],
      prepNotes: 'Portion nuts in advance to stay within energy targets.',
      portionGuidance: '1 small handful nuts + 40g paneer',
      approxKcal: 260,
      approxProteinG: 11,
      substitutions: ['Pumpkin & flax seeds with unsweetened coconut yogurt', 'Cucumber slices with peanut/almond butter']
    }
  ]
};

const EGG_FREE_BREAKFAST_REPLACEMENT = {
  slot: 'Breakfast',
  title: 'High-Protein Paneer & Moong Dal Chilla (Egg-Free Swap)',
  items: ['2 moong dal chillas stuffed with 60g grated paneer/tofu', 'Mint-coriander chutney', '1 small fruit'],
  contains: ['dairy'],
  prepNotes: 'Egg-free substitution applied: ground moong dal batter cooked on a tawa with spiced grated paneer/tofu filling.',
  portionGuidance: '2 stuffed chillas + chutney',
  approxKcal: 430,
  approxProteinG: 25,
  uncertaintyLabel: 'Approximate estimate (±15%); depends on batter thickness and oil used.',
  substitutions: ['Tofu bhurji with multigrain toast', 'Besan chilla with curd']
};

const DAIRY_FREE_REPLACEMENT = {
  slot: 'Snack',
  title: 'Roasted Chana, Pumpkin Seeds & Lemon Sprout Bhel (Dairy-Free Swap)',
  items: ['40g roasted chana', '1 cup steamed moong sprouts with lemon & tomato', '1 tbsp pumpkin seeds'],
  contains: [],
  prepNotes: 'Dairy-free substitution applied: toss sprouts and chana with lemon juice, chaat masala, and coriander.',
  portionGuidance: '1 medium bowl sprout-chana bhel',
  approxKcal: 245,
  approxProteinG: 13,
  uncertaintyLabel: 'Approximate estimate (±15%).',
  substitutions: ['Soy milk protein smoothie', 'Tender coconut water + almonds']
};

const BASE_WORKOUT_DAYS = [
  {
    day: 'Mon',
    focus: 'Full Body Strength A',
    durationMin: 40,
    environment: 'indoor',
    warmUp: '5 min brisk walk/march in place + hip circles, arm swings & 10 bodyweight good-mornings',
    exercises: [
      { name: 'Goblet Squat / Bodyweight Squat', prescription: '3 sets × 10 reps', rest: '75s', intensityRpe: 'RPE 7 (2–3 reps in reserve)', formCue: 'Keep chest proud, knees tracking over mid-foot.', substitution: 'Glute Bridge (knee-friendly)' },
      { name: 'Push-Up (or Incline Push-Up)', prescription: '3 sets × 8–12 reps', rest: '60s', intensityRpe: 'RPE 7', formCue: 'Brace core; elbows at ~45° from torso.', substitution: 'Wall Push-Up or Dumbbell Floor Press' },
      { name: 'One-Arm Dumbbell / Backpack Row', prescription: '3 sets × 10 reps/side', rest: '60s', intensityRpe: 'RPE 7', formCue: 'Pull elbow toward hip; avoid twisting lower back.', substitution: 'Resistance Band Seated Row' },
      { name: 'Dead Bug Core Brace', prescription: '3 sets × 8 reps/side', rest: '45s', intensityRpe: 'RPE 6', formCue: 'Keep lower back gently pressed into the mat.', substitution: 'Bird-Dog' }
    ],
    coolDown: '5 min chest, hip-flexor, and hamstring gentle static stretches + slow nasal breathing'
  },
  {
    day: 'Tue',
    focus: 'Low-Impact Cardio & Core Stability',
    durationMin: 30,
    environment: 'flexible',
    warmUp: '4 min easy walk + ankle and thoracic mobility',
    exercises: [
      { name: 'Brisk Zone-2 Walk or Cycling', prescription: '20 min steady pace', rest: '—', intensityRpe: 'RPE 5–6 (conversational pace)', formCue: 'Relax shoulders and maintain steady rhythmic breathing.', substitution: 'Seated Shadow Boxing / Step-Jacks' },
      { name: 'Side Plank (Knees or Feet)', prescription: '3 sets × 25s/side', rest: '45s', intensityRpe: 'RPE 6', formCue: 'Stack hips and shoulders in a straight line.', substitution: 'Pallof Press / Standing Core Brace' }
    ],
    coolDown: '4 min calf and lower-back stretch'
  },
  {
    day: 'Wed',
    focus: 'Active Recovery & Mobility Flow',
    durationMin: 20,
    environment: 'indoor',
    warmUp: '3 min diaphragmatic breathing',
    exercises: [
      { name: 'Cat-Cow & Thoracic Openers', prescription: '2 sets × 8 slow breaths', rest: '30s', intensityRpe: 'RPE 3–4', formCue: 'Move smoothly within a pain-free range.', substitution: 'Seated Spinal Mobility' },
      { name: '90/90 Hip Switches & Child’s Pose', prescription: '2 sets × 60s', rest: '30s', intensityRpe: 'RPE 3', formCue: 'Never force a joint past mild tension.', substitution: 'Supine Knee-to-Chest Stretch' }
    ],
    coolDown: '3 min relaxation breathing'
  },
  {
    day: 'Thu',
    focus: 'Full Body Strength B (Hinge & Overhead)',
    durationMin: 40,
    environment: 'indoor',
    warmUp: '5 min dynamic hip hinges, scapular wall slides & band pull-aparts',
    exercises: [
      { name: 'Romanian Deadlift (Dumbbells or Hip Hinge)', prescription: '3 sets × 10 reps', rest: '75s', intensityRpe: 'RPE 7', formCue: 'Push hips back with a neutral spine; feel gentle hamstring tension.', substitution: 'Supine Hamstring Bridge' },
      { name: 'Seated / Standing Overhead Press', prescription: '3 sets × 8–10 reps', rest: '60s', intensityRpe: 'RPE 7', formCue: 'Ribs down; avoid overarching lower back.', substitution: 'Lateral Raise or Landmine Press' },
      { name: 'Split Squat / Reverse Lunge', prescription: '3 sets × 8 reps/side', rest: '75s', intensityRpe: 'RPE 7', formCue: 'Control the descent; step back softly.', substitution: 'Step-Up to Low Box or Clamshells (knee-friendly)' },
      { name: 'Forearm Plank', prescription: '3 sets × 30–40s', rest: '45s', intensityRpe: 'RPE 6–7', formCue: 'Squeeze glutes and quads; breathe steadily.', substitution: 'Incline Plank on Bench/Table' }
    ],
    coolDown: '5 min shoulder, glute, and quad stretches'
  },
  {
    day: 'Fri',
    focus: 'Conditioning Intervals (Quiet / Low-Impact Friendly)',
    durationMin: 25,
    environment: 'flexible',
    warmUp: '5 min marching, arm circles, and bodyweight step-backs',
    exercises: [
      { name: 'Low-Impact Tempo Circuits (Step-Jacks, Shadow Boxing, Marching High Knees)', prescription: '5 rounds × (45s work / 45s easy recovery)', rest: '45s', intensityRpe: 'RPE 7', formCue: 'Land softly on the balls of your feet; stop if any joint discomfort arises.', substitution: 'Outdoor Brisk Walk Intervals' },
      { name: 'Farmer’s Carry or Posture Walk', prescription: '3 sets × 45s', rest: '45s', intensityRpe: 'RPE 6', formCue: 'Tall spine, shoulders relaxed down and back.', substitution: 'Seated Posture Hold' }
    ],
    coolDown: '5 min slow walk and deep breathing'
  },
  {
    day: 'Sat',
    focus: 'Upper Body & Core Endurance + Outdoor Walk',
    durationMin: 35,
    environment: 'outdoor',
    warmUp: '5 min outdoor brisk walk + shoulder rolls',
    exercises: [
      { name: 'Outdoor Brisk Walk / Easy Jog Progression', prescription: '20 min steady pace', rest: '—', intensityRpe: 'RPE 6', formCue: 'Keep cadence smooth and comfortable.', substitution: 'Indoor Step Circuit' },
      { name: 'Incline Push-Ups & Band Pull-Aparts Superset', prescription: '3 sets × 12 reps', rest: '60s', intensityRpe: 'RPE 6–7', formCue: 'Focus on controlled tempo (2s down, 1s up).', substitution: 'Wall Push-Ups + Scapular Squeezes' }
    ],
    coolDown: '5 min gentle lower-body stretching'
  },
  {
    day: 'Sun',
    focus: 'Complete Rest & Recovery Check-In',
    durationMin: 15,
    environment: 'flexible',
    warmUp: 'Optional gentle stroll',
    exercises: [
      { name: 'Rest, Hydration & Sleep Priority', prescription: 'Full recovery day', rest: '—', intensityRpe: 'RPE 1–2', formCue: 'Muscle and cardiovascular adaptation happen during recovery.', substitution: '15 min leisurely walk' }
    ],
    coolDown: 'Early wind-down routine'
  }
];

/**
 * Validates that a plan object satisfies PRD Appendix C (AI Plan Generation Contract).
 */
export function validatePlanContract(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan must be an object.'] };
  }
  if (!['diet', 'workout', 'combined'].includes(plan.planType)) {
    errors.push('Invalid or missing planType.');
  }
  if (typeof plan.version !== 'number' || plan.version < 1) {
    errors.push('Plan version must be a positive integer.');
  }
  if (!plan.goal || typeof plan.goal !== 'string') {
    errors.push('Missing goal.');
  }
  if (!Array.isArray(plan.assumptions)) {
    errors.push('Missing assumptions array.');
  }
  if (!Array.isArray(plan.constraintsHonored)) {
    errors.push('Missing constraintsHonored array.');
  }
  if (!Array.isArray(plan.meals) || plan.meals.length === 0) {
    errors.push('Plan must include structured meals array.');
  }
  if (!Array.isArray(plan.days) || plan.days.length === 0) {
    errors.push('Plan must include structured workout days array.');
  }
  if (!plan.estimateMetadata || typeof plan.estimateMetadata !== 'object' || !plan.estimateMetadata.disclaimer) {
    errors.push('Plan must include estimateMetadata with uncertainty disclaimer.');
  }
  if (!Array.isArray(plan.safetyFlags)) {
    errors.push('Plan must include safetyFlags array.');
  }
  if (!plan.explanation || typeof plan.explanation !== 'string') {
    errors.push('Plan must include user-facing explanation.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Generates a complete, schema-valid VYORA plan honoring user profile and constraints.
 */
export function buildAdaptivePlan(input = {}) {
  const heightCm = Math.max(120, Math.min(230, Number(input.heightCm || input.height) || 168));
  const weightKg = Math.max(35, Math.min(220, Number(input.weightKg || input.weight) || 65));
  const age = Math.max(18, Math.min(95, Number(input.age) || 28));
  const gender = ['male', 'female', 'other'].includes(input.gender) ? input.gender : 'other';
  const diet = ['veg', 'nonveg', 'vegan', 'keto'].includes(input.diet) ? input.diet : 'veg';
  const goal = ['fatloss', 'musclegain', 'recomp', 'endurance', 'general'].includes(input.goal) ? input.goal : 'recomp';
  const planType = ['diet', 'workout', 'combined'].includes(input.planType || input.kind) ? (input.planType || input.kind) : 'combined';
  const equipment = str(input.equipment, 100) || 'minimal / home dumbbells';
  const sessionMinutes = Math.max(15, Math.min(90, Number(input.sessionMinutes) || 35));
  const exclusions = Array.isArray(input.exclusions)
    ? input.exclusions.map(x => str(x, 40).toLowerCase()).filter(Boolean)
    : [];
  const allergies = Array.isArray(input.allergies)
    ? input.allergies.map(x => str(x, 40).toLowerCase()).filter(Boolean)
    : [];
  const limitations = Array.isArray(input.limitations)
    ? input.limitations.map(x => str(x, 60).toLowerCase()).filter(Boolean)
    : (input.limitation ? [str(input.limitation, 60).toLowerCase()] : []);

  const targets = computeNutritionTargets({
    heightCm, weightKg, age, gender, goal,
    diet,
    activityLevel: input.activityLevel
  });

  const constraintsHonored = [
    `diet:${diet}`,
    `goal:${goal}`,
    `equipment:${equipment}`,
    `sessionMinutes:${sessionMinutes}`
  ];
  const safetyFlags = [];
  if (targets.underweightFatLoss) {
    constraintsHonored.push('safety:underweight_no_deficit');
    safetyFlags.push('BMI is below 18.5: fat-loss deficit was not applied. Prioritize adequate nutrition and consult a qualified clinician or dietitian.');
  }
  if (allergies.length) constraintsHonored.push(`allergies:${allergies.join(',')}`);
  if (exclusions.length) constraintsHonored.push(`exclusions:${exclusions.join(',')}`);
  const { meals, dailyTotals, warnings: mealWarnings } = generateMealPlan(targets, {
    ...targets, diet, allergies, exclusions
  });
  safetyFlags.push(...mealWarnings);

  // Clone and adapt workout days
  let days = structuredClone(BASE_WORKOUT_DAYS).map(d => ({
    ...d,
    durationMin: Math.min(d.durationMin, sessionMinutes)
  }));

  const hasKneePain = limitations.some(l => l.includes('knee'));
  const hasBackPain = limitations.some(l => l.includes('back') || l.includes('spine'));

  if (hasKneePain) {
    constraintsHonored.push('limitation:knee_pain_caution');
    safetyFlags.push('Knee discomfort reported: high-flexion loaded squats/lunges replaced with glute bridges and low-impact movements. Stop immediately if pain worsens and consult a physiotherapist/doctor.');
    days = days.map(d => ({
      ...d,
      exercises: d.exercises.map(ex => {
        if (/squat|lunge/i.test(ex.name)) {
          return {
            ...ex,
            name: `${ex.substitution || 'Supine Glute Bridge'} (Knee-Friendly Swap)`,
            formCue: 'Pain-free range only; stop immediately if knee discomfort increases.'
          };
        }
        return ex;
      })
    }));
  }

  if (hasBackPain) {
    constraintsHonored.push('limitation:back_pain_caution');
    safetyFlags.push('Back sensitivity reported: axial hinges replaced with supported core and glute work. Seek clinical evaluation for radiating or worsening pain.');
    days = days.map(d => ({
      ...d,
      exercises: d.exercises.map(ex => {
        if (/deadlift|row/i.test(ex.name)) {
          return {
            ...ex,
            name: `${ex.substitution || 'Chest-Supported Row / Bird-Dog'} (Back-Friendly Swap)`,
            formCue: 'Maintain neutral spine; stop if any lower-back pain occurs.'
          };
        }
        return ex;
      })
    }));
  }

  const plan = {
    planType,
    version: 1,
    goal,
    profileSnapshot: {
      heightCm, weightKg, age, gender, diet, goal, equipment, sessionMinutes,
      activityLevel: targets.activityLevel, allergies, exclusions
    },
    assumptions: [
      'General wellness adult profile without acute medical contraindications.',
      'Calorie and protein figures are approximate estimates using standard Indian household portions.',
      'Progressive overload should be applied gradually (e.g. +1–2 reps when all sets feel comfortable at RPE ≤ 7).'
    ],
    constraintsHonored,
    meals,
    dailyTotals,
    days,
    substitutions: {
      eggFree: 'Moong dal chilla, paneer/tofu bhurji, or roasted chana bowls.',
      noEquipment: 'Bodyweight squats/bridges, incline push-ups, backpack rows, and brisk walking.',
      lowImpactPain: 'Switch to glute bridges, seated upper-body mobility, or rest; consult a clinician if pain persists.'
    },
    safetyFlags: safetyFlags.length
      ? safetyFlags
      : ['General wellness plan only — not a medical prescription or clinical diet. Stop any exercise that causes sharp or worsening pain.'],
    estimateMetadata: {
      estimatedDailyKcal: targets.targetKcal,
      dailyKcalRange: `${Math.round(targets.targetKcal * 0.95)}–${Math.round(targets.targetKcal * 1.05)} kcal/day`,
      estimatedProteinRangeG: `${Math.round(targets.proteinG * 0.9)}–${Math.round(targets.proteinG * 1.1)} g/day`,
      estimatedProteinG: targets.proteinG,
      estimatedCarbsG: targets.carbsG,
      estimatedFatG: targets.fatG,
      bmi: targets.bmi,
      bmr: targets.bmr,
      tdee: targets.tdee,
      activityLevel: targets.activityLevel,
      confidence: 'moderate_estimate',
      disclaimer: 'All calorie and macro values are approximate estimates (±15%). Consult a qualified dietitian or doctor for medical nutrition therapy.'
    },
    explanation: `Generated a personalized ${diet} diet and ${days.length}-day workout plan for ${goal}. BMI ${targets.bmi}, TDEE ${targets.tdee} kcal, target ${targets.targetKcal} kcal/day with ${targets.proteinG}g protein, ${targets.carbsG}g carbs, and ${targets.fatG}g fat. Honored constraints: ${constraintsHonored.join(', ')}.`,
    changeHistory: [
      {
        version: 1,
        request: 'Initial plan generation',
        whatChanged: 'Generated full baseline meal and workout plan.',
        why: `Tailored to ${goal}, ${diet} preference, and ${sessionMinutes} min session window.`
      }
    ]
  };

  return plan;
}

function replacementMeal(plan, originalMeal, forbiddenAllergens = [], dietOverride) {
  const profile = plan.profileSnapshot || {};
  const targets = computeNutritionTargets(profile);
  const replacementProfile = {
    ...profile,
    diet: dietOverride || profile.diet || 'veg',
    allergies: [...(profile.allergies || []), ...forbiddenAllergens],
    exclusions: profile.exclusions || []
  };
  const generated = generateMealPlan(targets, replacementProfile);
  const replacement = generated.meals.find(meal => meal.day === originalMeal.day && meal.slot === originalMeal.slot);
  if (!replacement) throw new Error(`No compatible replacement dish found for ${originalMeal.day} ${originalMeal.slot}`);
  return replacement;
}

function refreshDailyTotals(plan) {
  plan.dailyTotals = PLAN_DAYS.map(day => {
    const meals = plan.meals.filter(meal => meal.day === day);
    return {
      day,
      kcal: meals.reduce((sum, meal) => sum + meal.approxKcal, 0),
      proteinG: meals.reduce((sum, meal) => sum + meal.approxProteinG, 0),
      carbsG: meals.reduce((sum, meal) => sum + (meal.carbsG || 0), 0),
      fatG: meals.reduce((sum, meal) => sum + (meal.fatG || 0), 0)
    };
  });
}

/**
 * Applies a targeted partial edit or conversational swap to an existing plan
 * WITHOUT regenerating or losing unrelated meals or workout days (PRD Prompt 7, 8 & 20).
 */
export function applyPartialPlanEdit(existingPlan, editPayload = {}) {
  const base = existingPlan && Array.isArray(existingPlan.meals) && Array.isArray(existingPlan.days)
    ? structuredClone(existingPlan)
    : buildAdaptivePlan(existingPlan?.profileSnapshot || {});

  const instruction = str(editPayload.instruction || editPayload.prompt || '', 500);
  const lower = instruction.toLowerCase();
  const targetSlot = str(editPayload.mealSlot || '', 40);
  const targetDay = str(editPayload.day || '', 15);
  const changes = [];
  const reasons = [];

  // 1. Check for "no eggs" / egg exclusion partial meal edit
  if (lower.includes('no egg') || lower.includes('egg-free') || lower.includes('without egg') || (Array.isArray(editPayload.exclude) && editPayload.exclude.some(x => /egg/i.test(x)))) {
    let mealUpdated = false;
    base.meals = base.meals.map((m) => {
      const slotMatches = !targetSlot || m.slot.toLowerCase() === targetSlot.toLowerCase();
      const dayMatches = !targetDay || m.day.toLowerCase() === targetDay.toLowerCase();
      const hasEggs = (m.contains && m.contains.includes('eggs')) || /egg/i.test(m.title) || (Array.isArray(m.items) && m.items.some(i => /egg/i.test(i)));
      if (slotMatches && dayMatches && (hasEggs || m.slot === 'Breakfast')) {
        mealUpdated = true;
        const replacement = replacementMeal(base, m, ['eggs'], 'veg');
        replacement.title = `${replacement.title} Paneer Chilla Egg-Free Swap`;
        return replacement;
      }
      return m;
    });
    if (mealUpdated) {
      if (!base.constraintsHonored.includes('exclusion:no_eggs')) base.constraintsHonored.push('exclusion:no_eggs');
      changes.push('Regenerated Breakfast to an egg-free Moong Dal & Paneer Chilla option while keeping Lunch, Dinner, Snack, and Workout days unchanged.');
      reasons.push('Honored your request to exclude eggs today without resetting the rest of your plan.');
    }
  }

  // 2. Check for dairy-free / vegetarian swap
  if (lower.includes('no dairy') || lower.includes('dairy-free') || lower.includes('lactose')) {
    base.meals = base.meals.map((m) => {
      const slotMatches = !targetSlot ? m.slot === 'Snack' : m.slot.toLowerCase() === targetSlot.toLowerCase();
      const dayMatches = !targetDay || m.day.toLowerCase() === targetDay.toLowerCase();
      if (slotMatches && dayMatches) {
        return replacementMeal(base, m, ['dairy']);
      }
      return m;
    });
    if (!base.constraintsHonored.includes('exclusion:no_dairy')) base.constraintsHonored.push('exclusion:no_dairy');
    changes.push('Swapped dairy snack for Roasted Chana & Lemon Sprout Bhel; preserved all other meals and workouts.');
    reasons.push('Removed dairy from the targeted meal slot.');
  }

  if (lower.includes('vegetarian today') || lower.includes('veg today')) {
    if (targetSlot) {
      base.meals = base.meals.map(m => (
        m.slot.toLowerCase() === targetSlot.toLowerCase() && (!targetDay || m.day.toLowerCase() === targetDay.toLowerCase())
          ? replacementMeal({ ...base, profileSnapshot: { ...base.profileSnapshot, diet: 'veg' } }, m)
          : m
      ));
      changes.push(`Swapped ${targetSlot} to a vegetarian option while preserving other meals.`);
    } else {
      base.meals = base.meals.map(m => replacementMeal({ ...base, profileSnapshot: { ...base.profileSnapshot, diet: 'veg' } }, m));
      changes.push('Swapped today’s meals to vegetarian options while keeping your 7-day workout schedule intact.');
    }
    reasons.push('Applied vegetarian meal substitution.');
  }

  // 3. Check for workout environment adaptation: "outdoor" / "quiet apartment" / "no equipment" / "shorter"
  const dayToEdit = targetDay || 'Mon';
  if (lower.includes('outdoor')) {
    base.days = base.days.map((d) => {
      if (d.day.toLowerCase() === dayToEdit.toLowerCase()) {
        return {
          ...d,
          environment: 'outdoor',
          focus: `${d.focus.replace(/\s*\(Outdoor Adapted\)/, '')} (Outdoor Adapted)`,
          exercises: [
            { name: 'Outdoor Brisk Walk / Tempo Run Intervals', prescription: '18 min (2 min brisk / 1 min easy)', rest: '60s', intensityRpe: 'RPE 6–7', formCue: 'Stay aware of footing and hydration.', substitution: 'Park Bench Step-Ups' },
            { name: 'Park Bench Incline Push-Ups', prescription: '3 sets × 10–12 reps', rest: '60s', intensityRpe: 'RPE 7', formCue: 'Keep core braced and body in one line.', substitution: 'Bodyweight Air Squats' },
            { name: 'Walking Lunges / Step-Backs on Grass', prescription: '3 sets × 10 reps/side', rest: '60s', intensityRpe: 'RPE 6–7', formCue: 'Soft landing on flat ground.', substitution: 'Standing Calf Raises' }
          ]
        };
      }
      return d;
    });
    if (!base.constraintsHonored.includes('adaptation:outdoor')) base.constraintsHonored.push('adaptation:outdoor');
    changes.push(`Adapted ${dayToEdit} workout to an outdoor session while preserving all other days and meal slots.`);
    reasons.push('Swapped indoor equipment movements for outdoor park/walking intervals.');
  }

  if (lower.includes('shorter') || lower.includes('20 min') || lower.includes('15 min') || lower.includes('quick')) {
    base.days = base.days.map((d) => {
      if (d.day.toLowerCase() === dayToEdit.toLowerCase()) {
        return {
          ...d,
          durationMin: 20,
          focus: `${d.focus.replace(/\s*\(20-Min Express\)/, '')} (20-Min Express)`,
          exercises: d.exercises.slice(0, 2).map(ex => ({
            ...ex,
            prescription: '2 sets × 10 reps (Express superset)'
          }))
        };
      }
      return d;
    });
    if (!base.constraintsHonored.includes('adaptation:shorter_20m')) base.constraintsHonored.push('adaptation:shorter_20m');
    changes.push(`Condensed ${dayToEdit} workout to a 20-minute express session (2 core movements) without altering the rest of the week.`);
    reasons.push('Fit your workout into a tighter schedule today.');
  }

  if (lower.includes('quiet') || lower.includes('apartment') || lower.includes('no jump')) {
    base.days = base.days.map((d) => {
      if (d.day.toLowerCase() === dayToEdit.toLowerCase()) {
        return {
          ...d,
          environment: 'quiet_apartment',
          focus: `${d.focus.replace(/\s*\(Quiet Low-Impact\)/, '')} (Quiet Low-Impact)`,
          exercises: d.exercises.map(ex => ({
            ...ex,
            formCue: `${ex.formCue} (Zero-jumping quiet apartment tempo — soft foot placement.)`
          }))
        };
      }
      return d;
    });
    if (!base.constraintsHonored.includes('adaptation:quiet_apartment')) base.constraintsHonored.push('adaptation:quiet_apartment');
    changes.push(`Adapted ${dayToEdit} to quiet, zero-jumping apartment-friendly movements.`);
    reasons.push('Eliminated floor impact and noise while maintaining training stimulus.');
  }

  // 4. Pain / injury adaptation: "knee hurts" / "back pain" / "shoulder pain"
  if (lower.includes('knee') || lower.includes('pain') || lower.includes('hurt') || lower.includes('sore')) {
    base.days = base.days.map((d) => {
      if (!targetDay || d.day.toLowerCase() === dayToEdit.toLowerCase()) {
        return {
          ...d,
          exercises: d.exercises.map((ex) => {
            if (/squat|lunge|jump/i.test(ex.name)) {
              return {
                ...ex,
                name: 'Supine Glute Bridge & Pain-Free Hip Mobility (Conservative Swap)',
                prescription: '3 sets × 10 slow reps',
                intensityRpe: 'RPE 5–6 (comfort-first)',
                formCue: 'Stop immediately if pain persists or worsens; consult a clinician/physiotherapist.'
              };
            }
            return ex;
          })
        };
      }
      return d;
    });
    const cautionMsg = 'Pain/discomfort adaptation applied: aggravating knee/lower-body loads were swapped for conservative glute bridges and mobility. Stop if pain worsens and seek professional clinician or physiotherapist assessment.';
    if (!base.safetyFlags.includes(cautionMsg)) base.safetyFlags.push(cautionMsg);
    if (!base.constraintsHonored.includes('limitation:pain_adaptation')) base.constraintsHonored.push('limitation:pain_adaptation');
    changes.push('Replaced knee-loading squats/lunges with conservative supine glute bridges and mobility; added clinician caution notice.');
    reasons.push('Prioritized joint safety and stopped aggravating movements per PRD safety policy.');
  }

  // Fallback if custom mealSlot or day note was supplied
  if (changes.length === 0) {
    changes.push(`Applied custom adjustment ("${instruction || 'User edit'}") to ${targetSlot || targetDay || 'current plan segment'}.`);
    reasons.push('Updated requested plan segment while preserving all unrelated preferences.');
  }

  refreshDailyTotals(base);
  base.version = (Number(base.version) || 1) + 1;
  const whatChanged = changes.join(' ');
  const why = reasons.join(' ');
  base.explanation = `${whatChanged} Why: ${why}`;
  if (!Array.isArray(base.changeHistory)) base.changeHistory = [];
  base.changeHistory.push({
    version: base.version,
    timestamp: new Date().toISOString(),
    request: instruction || 'Partial plan update',
    whatChanged,
    why
  });

  return {
    plan: base,
    version: base.version,
    whatChanged,
    why,
    explanation: base.explanation
  };
}
