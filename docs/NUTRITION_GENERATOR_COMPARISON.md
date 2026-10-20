# Nutrition generator comparison (new tolerances)

## New published tolerances (single source of truth in `planEngine.js`)

| Rule | Constant | Value |
|------|----------|-------|
| Daily kcal | `CALORIE_TOLERANCE` | ±10% |
| Weekly average kcal | `WEEKLY_CALORIE_TOLERANCE` | ±5% |
| Daily protein | `PROTEIN_MIN_RATIO` / `PROTEIN_MAX_RATIO` | 85–130% of target |
| Protein kcal share | `PROTEIN_CALORIE_SHARE` | ≤35% of that day's kcal |

Hard rules unchanged: diet, allergies, keto carbs ≤10% kcal, variety, same-day lunch/dinner differences, fat toppings, supplements only as snack.

Accuracy note in `plan.explanation` is emitted **only** when a day is outside the bands above or the weekly average misses ±5%.

## Comparison (deterministic 300-profile typical sample)

BMI 18.5–30 bodies × ages 20/45/60 × sedentary/light/moderate × all diets × all goals, stride-sampled to 300 profiles. Same sample for both generators.

| Generator | Profiles tested | Failing profiles | Fail % | Failing days | Fail day % | Worst kcal dev % | Avg ms/plan |
|-----------|----------------:|-----------------:|-------:|-------------:|-----------:|-----------------:|------------:|
| **Day-level optimiser** | 300 | 190 | **63.33** | 421 | 20.05 | 27.5 | 189.9 |
| **Greedy per-slot** (git `f907ad3`) | 300 | 59 | **19.67** | 68 | 3.24 | 33.4 | 292.0 |

**Winner: greedy per-slot** (clearly better on failing profiles; >2% gap). Day-level optimiser removed from the working tree; `planEngine.js` is the greedy generator with the new constants.

Re-run the winning generator alone:

```bash
node scripts/nutrition_tolerance_report.mjs
```

## KNOWN_INFEASIBLE

Residual typical-set failures are **59** (more than 15). The allowlist was not expanded. The sweep test is restricted to the **typical 300-profile sample** and reports real counts. A separate test covers **extreme BMI** profiles (hard rules + accuracy-note behaviour only).

## Files

- `backend/src/services/planEngine.js` — greedy generator + new tolerances + conditional accuracy note
- `backend/test/diet-personalization.test.js` — typical-set sweep + extremes test
- `scripts/nutrition_tolerance_report.mjs` — re-runnable metrics
