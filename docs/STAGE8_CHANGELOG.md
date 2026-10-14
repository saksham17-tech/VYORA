# VYORA Stage 8 — Server-Validated Adaptive Plans, Partial Regeneration & Copilot Orchestration

**Built on:** Stage 7  
**Goal:** Implement the adaptive diet/workout planning contract and Copilot controls required by PRD Prompts 6, 7, 8, 18, 20 & Appendix C:
1. Server-validated plan generation (`POST /api/plans/generate`) enforcing Appendix C schema validation, safe calorie floors, Indian regional meal options, and explicit uncertainty metadata (`±15%` / `±150 kcal`).
2. Conversational partial plan regeneration (`PATCH /api/plans/:id`) so requests like *"no eggs today"*, *"make this an outdoor workout"*, *"shorter 20-min session"*, or *"my knee hurts"* regenerate **only** the affected meal or workout day while preserving all unrelated preferences, incrementing plan version, and recording what changed and why.
3. User-controlled Copilot memory (`GET/PUT/DELETE /api/chat/memory`), prompt-injection/medication-change safety refusals, structured intent detection (`recognizeIntent`), and AI safety incident reporting (`POST /api/ai/report`).
4. Frontend partial-swap quick action bar in `planner.js` and visible memory/audio/reporting controls in `copilot.js`.

---

## Key Changes

| File | Change |
|------|--------|
| `database/schema.sql` | Added `copilot_memory` and `ai_safety_reports` tables. |
| `backend/src/services/planEngine.js` | New service: `validatePlanContract`, `buildAdaptivePlan`, and `applyPartialPlanEdit` supporting Indian food patterns, exclusions (`no eggs`, `no dairy`), environment swaps (`outdoor`, `quiet apartment`, `20m express`), and conservative pain adaptations (`knee`/`back`). |
| `backend/src/services/aiSafety.js` | Added `recognizeIntent`, `detectUnsupportedOrInjection`, and `unsupportedMedicalResponse`. |
| `backend/src/routes/api.js` | Added `POST /api/plans/generate`, `PATCH /api/plans/:id`, `POST /api/ai/chat`, `GET/PUT/DELETE /api/chat/memory`, and `POST /api/ai/report`. |
| `frontend/public/js/planner.js` | Wired to `POST /api/plans/generate` and `PATCH /api/plans/:id`; added partial-regeneration quick buttons and replaced `innerHTML` with safe DOM construction. |
| `frontend/public/js/copilot.js` | Added Stop Audio, Memory Notes viewer, Clear Memory, and Report AI Answer controls. |
| `backend/test/stage8-plans-copilot.test.js` | Behavioural tests verifying schema-valid plan generation, partial regeneration preserving unaffected meals/days, Copilot memory CRUD, prompt-injection refusal, and safety reporting. |
