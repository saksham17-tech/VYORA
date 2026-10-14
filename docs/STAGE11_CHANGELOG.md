# VYORA Stage 11 — Special Training Engine (TRAIN / EXPLORE / COMPETE) & Progress/Recovery Analytics

**Built on:** Stage 10  
**Goal:** Implement the complete Special Training (`TRAIN / EXPLORE / COMPETE`) and Progress/Recovery Analytics engine specified in PRD Prompts 11 & 12:
1. **TRAIN (`GET /api/training/predictions`, `/api/training/comparison`, `/api/training/intelligence`)**:
   - Enforces a minimum data threshold (`>= 2` logged sessions) before generating race/performance predictions, and labels all predictions with explicit confidence ranges (`±6%–10%`).
   - Compares 7-day vs. prior 7-day training load, distinguishes manual logs from imported wearable data, and flags missing periods.
   - Summarizes consistency, rest/recovery balance, and pain-flagged movements.
2. **Gamification Controls (`PATCH /api/profile/gamification`)**:
   - Allows users to disable or enable streaks, milestones, and personal-best badges at any time.
3. **EXPLORE (`GET/POST/DELETE /api/training/routes`)**:
   - Saves personalized routes with distance, terrain, approximate elevation estimates, verified waypoints (`hydration`, `cafe`, `restroom`, `viewpoint`), visibility controls, and route privacy zones (`privacy_zone_km`).
4. **COMPETE (`GET /api/training/leaderboard`, `POST /api/training/leaderboard/opt-in`, `POST /api/training/leaderboard/leave`)**:
   - Opt-in display name, fair-play plausibility bounds (`0–400 km/week`), and instant hide/leave controls.
