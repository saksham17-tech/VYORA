/**
 * Stage 13 — Modular API Route Orchestrator
 * Mounts all PRD service boundaries including Admin, Moderation & Feature Flags.
 */
import { registerAuthRoutes } from './auth.js';
import { registerProfileRoutes } from './profile.js';
import { registerChatRoutes } from './chat.js';
import { registerPlanRoutes } from './plans.js';
import { registerWorkoutAndProgressRoutes } from './workouts.js';
import { registerReminderRoutes } from './reminders.js';
import { registerOvulaRoutes } from './ovula.js';
import { registerCommunityAndAdminRoutes } from './community.js';
import { registerEcosystemRoutes } from './ecosystem.js';
import { registerIntegrationRoutes } from './integrations.js';
import { registerTrainingRoutes } from './training.js';
import { registerAdminRoutes } from './admin.js';
import { getMailer, getTwilio, deliver } from '../services/providers.js';
import { startReminderScheduler } from '../services/reminderScheduler.js';

export function registerApiRoutes(app) {
  registerAuthRoutes(app);
  registerProfileRoutes(app);
  registerChatRoutes(app);
  registerPlanRoutes(app);
  registerWorkoutAndProgressRoutes(app);
  registerReminderRoutes(app);
  registerOvulaRoutes(app);
  registerCommunityAndAdminRoutes(app);
  registerEcosystemRoutes(app);
  registerIntegrationRoutes(app);
  registerTrainingRoutes(app);
  registerAdminRoutes(app);

  if (process.env.VYORA_NO_CRON !== '1') {
    startReminderScheduler({ deliver, getMailer, getTwilio });
  }
}
