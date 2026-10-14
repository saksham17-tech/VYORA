# VYORA Stage 5 — AI Safety Layer

**Built on:** Stage 4  
**Goal:** Enforce PRD safety requirements for the AI copilot — red-flag escalation, mode-specific policies, post-checks, and an offline gold-test harness.

---

## What was added

### 1. Safety service — `backend/src/services/aiSafety.js`
- **Shared safety rules** applied to every mode (no diagnosis, no medication changes, no extreme advice, escalate emergencies).
- **Mode-specific policies:**
  - `vyora` — general fitness & habits
  - `nutrition` — meals, substitutions, Indian food patterns
  - `ovula` — menstrual wellness companion (non-diagnostic)
  - `high_risk` — elevated caution for pain/injury/pregnancy/chronic context
- **Red-flag detector** (pattern-based): chest pain, breathing difficulty, fainting, suicidal ideation, severe/sudden pain or heavy bleeding, pregnancy complications, eating-disorder crisis, heart attack/stroke language.
- **High-risk context detector**: pregnancy, injury, chronic disease, minors.
- **Immediate escalate response** that does **not** call Gemini — advises urgent care and refuses to generate plans.
- **Post-check** on model answers for diagnosis-like language, medication-change advice, and false certainty.

### 2. `/api/chat` rewritten
- Pre-check → if red flag, return safety response immediately.
- Select policy based on mode + message content.
- Call Gemini only with the chosen system policy.
- Attach `safety` metadata to the response (`mode`, `redFlag`, `postCheck`).

### 3. Gold-test harness — `backend/test/ai-safety.test.js`
12 offline unit tests covering:
- Red-flag detection (positive + negative)
- Policy selection (ovula, nutrition, high_risk, escalate)
- Escalation response content
- Post-check for unsafe answer patterns

```bash
npm test
# or specifically:
node --test backend/test/ai-safety.test.js
```

All 12 tests pass.

---

## Behaviour examples

| User message | Result |
|--------------|--------|
| “Give me a 20-min no-equipment workout” | Normal VYORA policy → Gemini |
| “Suggest a vegetarian dinner, no eggs” | Nutrition policy → Gemini |
| “Tips for period cramps?” (mode=ovula) | OVULA policy → Gemini |
| “I have severe chest pain and can’t breathe” | **No Gemini call** — urgent-care escalation |
| “I am pregnant, what workouts are safe?” | High-risk policy → Gemini (cautious) |

---

## Limitations (honest)
- Red-flag detection is **pattern-based**, not clinical NLP. It will miss novel phrasing and non-English text until expanded.
- Post-check is lightweight regex; it does not replace human review of safety-critical releases.
- Full PRD evaluation plan (groundedness scoring, human review queue, clinician-reviewed OVULA content) remains future work.
- Provider safety settings (Gemini) are still a complementary layer, not the only defence.

---

## Files touched
- `backend/src/services/aiSafety.js` — **new**
- `backend/src/server.js` — chat route uses safety layer
- `backend/test/ai-safety.test.js` — **new**
- `docs/STAGE5_CHANGELOG.md` — this file
- `README.md` — stage banner

---

## Next stage options
- **Stage 5b** — Community report API + moderation queue using `community_reports`
- **Stage 6** — Split monolithic `server.js` into PRD service boundaries
- Expand red-flag patterns / multilingual support
- Wire audit_events logging for escalations
