import { db, isoNow } from '../db.js';
import { getMailer, getTwilio } from '../services/providers.js';

export function registerHealthRoutes(app) {
  function buildHealthPayload() {
    let dbReady = false;
    try {
      db.prepare('SELECT 1').get();
      dbReady = true;
    } catch {
      dbReady = false;
    }
    return {
      ok: dbReady,
      service: 'vyora-backend',
      time: isoNow(),
      dbReady,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      emailConfigured: Boolean(getMailer()),
      smsConfigured: Boolean(getTwilio())
    };
  }

  app.get('/api/health', (_req, res) => {
    res.json(buildHealthPayload());
  });

  // PRD Prompt 20 readiness endpoint
  app.get('/api/health/ready', (_req, res) => {
    const payload = buildHealthPayload();
    res.status(payload.ok ? 200 : 503).json(payload);
  });
}
