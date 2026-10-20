#!/usr/bin/env node
/**
 * Re-runnable nutrition accuracy report under published tolerances.
 * Usage: node scripts/nutrition_tolerance_report.mjs
 */
import {
  buildAdaptivePlan,
  CALORIE_TOLERANCE,
  WEEKLY_CALORIE_TOLERANCE,
  PROTEIN_MIN_RATIO,
  PROTEIN_MAX_RATIO,
  PROTEIN_CALORIE_SHARE
} from '../backend/src/services/planEngine.js';

function typical300() {
  const bodies = [
    { heightCm: 155, weightKg: 50 }, { heightCm: 158, weightKg: 55 },
    { heightCm: 160, weightKg: 58 }, { heightCm: 162, weightKg: 60 },
    { heightCm: 165, weightKg: 62 }, { heightCm: 165, weightKg: 68 },
    { heightCm: 168, weightKg: 70 }, { heightCm: 170, weightKg: 72 },
    { heightCm: 172, weightKg: 75 }, { heightCm: 175, weightKg: 78 },
    { heightCm: 178, weightKg: 82 }, { heightCm: 180, weightKg: 85 }
  ].filter(b => {
    const bmi = b.weightKg / ((b.heightCm / 100) ** 2);
    return bmi >= 18.5 && bmi <= 30;
  });
  const ages = [20, 45, 60];
  const activities = ['sedentary', 'light', 'moderate'];
  const genders = ['male', 'female'];
  const diets = ['veg', 'vegan', 'nonveg', 'keto'];
  const goals = ['fatloss', 'musclegain', 'recomp', 'endurance', 'general'];
  const all = [];
  for (const body of bodies) {
    for (const age of ages) {
      for (const activityLevel of activities) {
        for (const gender of genders) {
          for (const diet of diets) {
            for (const goal of goals) {
              all.push({ ...body, age, activityLevel, gender, diet, goal });
            }
          }
        }
      }
    }
  }
  const step = all.length / 300;
  return Array.from({ length: 300 }, (_, i) => all[Math.min(all.length - 1, Math.floor(i * step))]);
}

function dayFails(total, targetKcal, targetProtein) {
  const kd = Math.abs(total.kcal - targetKcal) / targetKcal;
  if (kd > CALORIE_TOLERANCE) return true;
  if (total.proteinG < targetProtein * PROTEIN_MIN_RATIO) return true;
  if (total.proteinG > targetProtein * PROTEIN_MAX_RATIO) return true;
  if (total.proteinG * 4 > total.kcal * PROTEIN_CALORIE_SHARE + 1) return true;
  return false;
}

const profiles = typical300();
let failingProfiles = 0;
let failingDays = 0;
let worst = 0;
const t0 = Date.now();
for (const profile of profiles) {
  const plan = buildAdaptivePlan(profile);
  const tk = plan.estimateMetadata.estimatedDailyKcal;
  const tp = plan.estimateMetadata.estimatedProteinG;
  let pf = false;
  for (const total of plan.dailyTotals) {
    worst = Math.max(worst, Math.abs(total.kcal - tk) / tk * 100);
    if (dayFails(total, tk, tp)) {
      failingDays += 1;
      pf = true;
    }
  }
  const weekAvg = plan.dailyTotals.reduce((sum, d) => sum + d.kcal, 0) / plan.dailyTotals.length;
  if (Math.abs(weekAvg - tk) / tk > WEEKLY_CALORIE_TOLERANCE) pf = true;
  if (pf) failingProfiles += 1;
}

console.log('Generator: greedy per-slot (winner under new tolerances)');
console.log('Tolerances: daily kcal ±' + (CALORIE_TOLERANCE * 100) + '%, weekly ±' + (WEEKLY_CALORIE_TOLERANCE * 100) + '%, protein ' + (PROTEIN_MIN_RATIO * 100) + '–' + (PROTEIN_MAX_RATIO * 100) + '% of target, protein ≤' + (PROTEIN_CALORIE_SHARE * 100) + '% of day kcal');
console.log(JSON.stringify({
  profilesTested: profiles.length,
  failingProfiles,
  failingDays,
  failProfilePct: +(failingProfiles / profiles.length * 100).toFixed(2),
  failDayPct: +(failingDays / (profiles.length * 7) * 100).toFixed(2),
  worstDeviationPct: +worst.toFixed(1),
  avgMsPerPlan: +((Date.now() - t0) / profiles.length).toFixed(1)
}, null, 2));
