# VYORA Stage 13 — Admin, Support, Moderation & Feature Flags Console

**Built on:** Stage 12  
**Goal:** Implement the operational governance, feature flag gating, partner verification, and least-privilege moderation requirements from PRD Prompt 17 & Section 16:
1. **Feature Flags Registry (`GET /api/feature-flags`, `PATCH /api/admin/feature-flags/:key`)**:
   - Seeds and manages runtime flags (`voice_copilot`, `sms_reminders`, `wearable_bridges`, `community_publishing`, `gamification_default`), keeping native wearable bridges safely behind a flag until platform approval.
2. **Least-Privilege Operations Overview (`GET /api/admin/overview`)**:
   - Summarizes open community reports, AI safety incidents, pending partner applications, and reminder delivery failures while strictly excluding personal health, vitals, and OVULA menstrual records (`healthDataExposedToSupport: false`).
3. **Partner Verification, AI Report Review & Delivery Failure Monitoring**:
   - `PATCH /api/admin/partners/:id/verify` (approve, suspend, or reject partner listings)
   - `GET/PATCH /api/admin/ai-reports/:id` (review and resolve reported AI outputs)
   - `GET /api/admin/delivery-failures` (redacted reminder failure inspection without exposing medication names)
4. **Frontend Admin & Operations Console (`frontend/public/js/admin.js`)**:
   - Interactive feature flag toggles and moderation summary counters with full audit logging.
