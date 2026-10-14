# VYORA Stage 7 — Verified Auth, OTP Flows, Purpose-Specific Consents & Audit Service

**Built on:** Stage 6  
**Goal:** Complete the authentication and privacy compliance foundation required by PRD Prompts 5, 9, 17, 19 & 20:
1. Close the unverified-destination bypass for registered accounts on `/api/reminders` and `/api/reminders/test`.
2. Implement Email/SMS OTP verification (`/api/auth/verify/request`, `/api/auth/verify/confirm`) and password reset (`/api/auth/password-reset/request`, `/api/auth/password-reset/confirm`) backed by SHA-256 hashed tokens in `verification_tokens`.
3. Wire Stage 4's `consent_records` and `audit_events` tables to live services (`backend/src/services/auditService.js`) and routes (`GET/POST /api/consents`, `DELETE /api/consents/:purpose`, `GET /api/audit`).
4. Add the frontend Account, OTP Verification, and Privacy/Consent Center UI (`frontend/public/js/account.js`) with visible *"Why we ask"* explanations.
5. Fix the Stage 6 test regression in `backend/test/project.test.js` and add behavioural HTTP integration tests in `backend/test/stage7-auth-consent.test.js`.

---

## Key Changes

| File | Change |
|------|--------|
| `backend/src/services/otpService.js` | New service: generates 6-digit OTPs, stores SHA-256 hashes in `verification_tokens` with 15m TTL, delivers via SMTP/Twilio or exposes `devCode` in non-production when unconfigured, and verifies with `crypto.timingSafeEqual`. |
| `backend/src/services/auditService.js` | New service: manages purpose-specific consents (`health_profile`, `ovula_cycle`, `medication_reminders`, `wearable_sync`, `community_publishing`, `location_discovery`) and writes redacted security/privacy events to `audit_events`. |
| `backend/src/routes/api.js` | Added `/api/auth/verify/*`, `/api/auth/password-reset/*`, `/api/consents`, `/api/audit`; fixed registered-user reminder destination validation so `email_verified = 1` / `phone_verified = 1` is strictly required before scheduling or testing outbound messages. |
| `frontend/public/js/account.js` | New UI module providing Login, Register, Link Guest → Account, Email/SMS OTP verification, Consent toggles with *"Why we ask"* descriptions, JSON export, and confirmed account deletion. |
| `frontend/public/js/api.js` | Added `requestOtp`, `confirmOtp`, `requestPasswordReset`, `confirmPasswordReset`, `listConsents`, `grantConsent`, `revokeConsent`, `listAudit`. |
| `backend/test/stage7-auth-consent.test.js` | End-to-end behavioural tests for guest-linking, unverified destination rejection, OTP verification, password reset, consent grant/revoke, and audit trail. |
