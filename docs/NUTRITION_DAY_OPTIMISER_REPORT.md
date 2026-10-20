# Nutrition Day-Level Optimiser Report

## Changes made

### 1. Day-level optimiser in `generateMealPlan` (`backend/src/services/planEngine.js`)

Replaced greedy per-slot selection with a true **day-level search**:

- Build up to **8 candidate variants per meal slot** (diet/allergy/cuisine/variety/keto filters).
- Shortlist mixes **budget-reachable**, **protein-forward**, and **score-ranked** dishes.
- Enumerate cross-slot combinations (capped ~400 for runtime), enforcing same-day lunch/dinner distinctness.
- **Tune scales** with coordinate descent on continuous macros, then a **global kcal scale** toward the daily target.
- **Render with practical quantity rounding**, then refine scales against rounded totals.
- Cost function:
  - `4 * |dayKcal - targetKcal| / targetKcal`
  - `+ proteinBandPenalty` (below 90%, above 125%, or protein > 35% of kcal)
  - `+ 0.1 * mean(|scale - 1|)`
- Progressive **relax levels** for weekly variety when the strict pool is empty.
- Post-search **snack / scale fix-up** for residual protein or kcal misses.

### 2. Tolerance constants (single source of truth)

Exported from `planEngine.js`:

- `CALORIE_TOLERANCE = 0.05` (±5%)
- `PROTEIN_MIN_RATIO = 0.9` (≥90% of target)
- `PROTEIN_MAX_RATIO = 1.25` (≤125% of target)
- `PROTEIN_CALORIE_SHARE = 0.35` (protein never above 35% of day kcal)

`diet-personalization.test.js` now imports and uses these constants for assertions and the 120-profile sweep.

### 3. Curated extreme dishes (`dishLibrary.js`)

Added low-calorie high-protein and high-calorie lower-protein curated dishes (soya salad, tofu scramble, whey water, rice-ghee-banana, roti-ghee stack, etc.) for 1350 kcal and 3000+ kcal profiles.

---

## Measured results (post-change)

### 120-profile sweep (same construction as the test)

| Metric | Value |
|--------|------:|
| Profiles tested | 120 |
| Failing profiles | **75–79** (~63–66%) |
| Failing days | **191–201** |
| Worst kcal deviation | ~25–47% |
| Avg `buildAdaptivePlan` time | **~155–175 ms** (under 400 ms ✓) |

### Typical-set style sample (BMI-like bodies × ages × activities × diets × goals)

Full 2,160-profile run was started; per-plan cost is acceptable (~150–300 ms) but total wall time is large. Subset runs (384–1080 profiles) showed **high double-digit failure rates**, dominated by:

1. **Protein low** on vegetarian/vegan days under weekly variety pressure  
2. **Protein high** on low body-weight / high relative protein-density days  
3. **Kcal overshoot/undershoot** after practical unit rounding (eggs, rotis, scoops)

### Runtime

Average **&lt; 400 ms** per `buildAdaptivePlan` on measured samples (typically 150–300 ms). Target met.

---

## Why the &lt;3% profile / &lt;1% day targets are not yet met

The day-level optimiser is in place and is better structured than pure greedy per-slot selection, but the **feasible region** for many profiles is empty or nearly empty under simultaneous constraints:

- Practical scale bounds (`scaleMin`/`scaleMax`)
- Discrete rounded portions
- Diet + allergy + cuisine filters  
- Same-day lunch/dinner distinctness  
- Weekly variety  
- Keto carb cap  
- Protein band **and** ±5% calories together  

Especially hard:

- **~1350 kcal + ~90g protein** vegetarian (needs ~0.067 g protein/kcal across the day)
- **~3200 kcal + ~150g protein** with meat variety limits
- **High endurance kcal + low reference-weight protein** (needs energy-dense low-protein dishes)

Closing the gap to &lt;3% / &lt;1% likely requires **more curated dish variants** (especially vegan high-protein low-kcal and nonveg energy-dense low-protein), and/or a **slightly softer protein band for extreme BMI×goal corners** (product decision), not only optimiser structure.

---

## Files touched

- `backend/src/services/planEngine.js` — day optimiser, exported tolerances  
- `backend/src/services/dishLibrary.js` — curated extreme dishes  
- `backend/test/diet-personalization.test.js` — tolerance imports and failure criteria  

`KNOWN_INFEASIBLE` in the test should be rebuilt from a fresh sweep after the next accuracy improvement; the previous long list is stale relative to this optimiser.
