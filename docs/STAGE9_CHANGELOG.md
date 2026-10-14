# VYORA Stage 9 — Reminder Lifecycle Polish, OVULA Compliance, Community Moderation & Integrations

**Built on:** Stage 8  
**Goal:** Complete the reminder reliability, OVULA cycle privacy, community moderation, and health-platform integration requirements from PRD Prompts 9–17, 19, 20 & Appendix B:
1. **Reminder Lifecycle (`reminderScheduler.js`, `providers.js`, `/api/reminders*`)**:
   - Minimal lock-screen message preview by default (`minimal_preview = 1`) so medication/condition names are not exposed on lock screens unless opted in.
   - Quiet hours (`quiet_start`, `quiet_end`) suppression and next scheduled occurrence calculation (`nextOccurrence`).
   - Explicit voice reminder read-back confirmation check (`VOICE_CONFIRMATION_REQUIRED`).
   - Automatic cancellation of pending delivery occurrences on reminder pause/delete, plus `/api/reminders/opt-out` and `/api/reminders/opt-in`.
2. **OVULA Menstrual Wellness (`/api/ovula/cycle`, `/api/ovula/export`, `/api/ovula/data`)**:
   - Enforces `ovula_cycle` consent, attaches contraception/non-diagnosis disclaimers, screens symptoms for red flags on entry creation, and provides dedicated OVULA export & full data deletion.
3. **Community Moderation & Bug Fixes (`/api/community/reports`, `/api/admin/reports`)**:
   - Fixes the `500` error on duplicate comments (`UNIQUE(post_id, user_id, kind, body)`) by returning a clean `409 Conflict` (`DUPLICATE_COMMENT`).
   - Wires Stage 4's `community_reports` table to user report submission and moderator review endpoints with audit logging.
4. **Health Integrations & PRD Route Aliases (`/api/integrations/*`, `/api/progress`, `/api/partners/apply`, `/api/trainers/bookings`, `/api/health/ready`)**:
   - Wires `integration_connections` and `imported_metrics` with honest native-bridge labeling, never returning raw tokens, and cleaning up imported metrics on disconnect.
   - Adds unit-validated `/api/progress` and PRD route aliases.
