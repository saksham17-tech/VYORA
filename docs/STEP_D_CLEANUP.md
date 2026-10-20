# Step D — Revert to greedy + clean-up

## Generator decision

Calorie-tier templates failed **58.67%** of typical profiles vs greedy **19.67%**.  
`planEngine.js` is restored to the **greedy per-slot** generator (git `f907ad3` baseline) with published tolerances:

- Daily kcal ±10% (`CALORIE_TOLERANCE`)
- Weekly average kcal ±5% (`WEEKLY_CALORIE_TOLERANCE`)
- Protein 85–130% of target, ≤35% of day kcal

Template artifacts (`mealTemplates.json`) removed.

## Sweep (re-run: `node scripts/sweep.mjs`)

| Metric | Value |
|--------|------:|
| Profiles tested | 300 |
| Failing profiles | 59 |
| Fail profile % | 19.67% |
| Failing days | 69 |
| Fail day % | 3.29% |
| Worst kcal deviation | 29.5% |
| Avg ms/plan | ~285 |

`KNOWN_INFEASIBLE`: 59 residual failures (>15). Typical-set sweep reports real counts; extreme-BMI test covers hard rules + accuracy note only (no long allowlist).

## Library clean-up

- Removed near-duplicate **Masoor Dal with Millet and Bhindi** base definition (`veg-masoor-millet` and generated variants).
- Renamed generated-sounding keto dishes (e.g. “Paneer with Garlic Ghee Lunch” → “Paneer Tikka with Garlic Ghee”, skillet/lunch suffix names → natural bowl/skillet names).

## Keto egg daily cap

Max **2** egg/egg-white-containing dishes per day on keto (alongside existing cheese/salmon caps).

## Stage 13 test

`stage13-admin-moderation-flags.test.js` now deletes `test_stage13.sqlite` (+ wal/shm) **before** importing the server module so flag/partner state cannot leak across runs.

## Files touched (intended)

- `backend/src/services/planEngine.js`
- `backend/src/services/dishLibrary.js`
- `backend/test/stage13-admin-moderation-flags.test.js`
- `backend/test/diet-personalization.test.js` (tolerances / typical sweep — already aligned)
- `scripts/sweep.mjs`
- `docs/STEP_D_CLEANUP.md`

**Not** modified: `Dockerfile`, `render.yaml`, `.gitignore`, database schema files.
