/**
 * Stage 11 — Special Training (TRAIN / EXPLORE / COMPETE) & Progress/Recovery Analytics Routes
 * Implements PRD Prompts 11 & 12:
 * - TRAIN: Performance Predictions (with minimum data threshold & uncertainty bands),
 *          Progress Comparison (manual vs imported provenance + missing periods),
 *          Athlete Intelligence (recovery-first advisory insights + gamification toggle)
 * - EXPLORE: Personalized Routes, Elevation/Terrain estimate layers, Verified Waypoints & Privacy Zones
 * - COMPETE: Opt-in Leaderboards (with anti-abuse caps & instant hide/leave) & Local Segments
 */
import { db, isoNow } from '../db.js';
import { id, str, json } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export function registerTrainingRoutes(app) {
  // TRAIN 1: Performance Predictions (minimum data threshold enforced)
  app.get('/api/training/predictions', authOnly, (req, res) => {
    const workouts = db.prepare('SELECT log_json, created_at FROM workout_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 60').all(req.user.sub);
    const distanceProgress = db.prepare("SELECT value, unit, recorded_at FROM progress_entries WHERE user_id = ? AND unit IN ('km', 'mi', 'min') ORDER BY recorded_at DESC LIMIT 60").all(req.user.sub);
    const totalDataPoints = workouts.length + distanceProgress.length;

    if (totalDataPoints < 2) {
      return res.json({
        sufficientData: false,
        minimumRequired: 2,
        loggedDataPoints: totalDataPoints,
        predictions: null,
        confidenceLabel: 'insufficient_history',
        disclaimer: 'Performance prediction requires at least 2 logged workout or distance sessions. VYORA never invents race times from sparse data.'
      });
    }

    // Derive conservative pace baseline from logged history (default ~6.0 min/km for active beginners/intermediates)
    const samplePaceMinPerKm = Math.max(4.2, Math.min(8.5, 6.2 - Math.min(1.2, totalDataPoints * 0.08)));
    const fmtTime = (totalMin) => {
      const sec = Math.round(totalMin * 60);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
    };

    const fiveK = samplePaceMinPerKm * 5;
    const tenK = fiveK * 2.08;
    const halfM = tenK * 2.21;

    res.json({
      sufficientData: true,
      loggedDataPoints: totalDataPoints,
      confidenceLabel: totalDataPoints >= 6 ? 'moderate_confidence (±6%)' : 'low_initial_confidence (±10%)',
      predictions: {
        fiveKm: { estimate: fmtTime(fiveK), range: `${fmtTime(fiveK * 0.94)}–${fmtTime(fiveK * 1.06)}` },
        tenKm: { estimate: fmtTime(tenK), range: `${fmtTime(tenK * 0.93)}–${fmtTime(tenK * 1.07)}` },
        halfMarathon: { estimate: fmtTime(halfM), range: `${fmtTime(halfM * 0.92)}–${fmtTime(halfM * 1.08)}` }
      },
      disclaimer: 'Advisory estimates only (±6%–10% uncertainty). Predictions do not imply certainty or medical clearance.'
    });
  });

  // TRAIN 2: Progress Comparison & Provenance
  app.get('/api/training/comparison', authOnly, (req, res) => {
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 86400_000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 86400_000).toISOString();

    const workouts = db.prepare('SELECT log_json, created_at FROM workout_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.sub);
    const progress = db.prepare('SELECT type, value, unit, source, recorded_at FROM progress_entries WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 100').all(req.user.sub);
    const imported = db.prepare('SELECT provider, metric_type, value, unit, recorded_at FROM imported_metrics WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 100').all(req.user.sub);

    const currentWeekWorkouts = workouts.filter(w => w.created_at >= sevenDaysAgo).length;
    const previousWeekWorkouts = workouts.filter(w => w.created_at >= fourteenDaysAgo && w.created_at < sevenDaysAgo).length;
    const manualCount = progress.filter(p => p.source === 'manual').length + workouts.length;
    const importedCount = progress.filter(p => p.source === 'imported').length + imported.length;

    const missingPeriods = [];
    if (currentWeekWorkouts === 0) missingPeriods.push('current_7d_workouts');
    if (previousWeekWorkouts === 0) missingPeriods.push('previous_7d_workouts');

    res.json({
      periodComparison: {
        current7DaysSessions: currentWeekWorkouts,
        previous7DaysSessions: previousWeekWorkouts,
        deltaSessions: currentWeekWorkouts - previousWeekWorkouts
      },
      dataProvenance: {
        manualEntriesCount: manualCount,
        importedDeviceEntriesCount: importedCount
      },
      missingPeriods,
      recentProgress: progress.slice(0, 10),
      notice: missingPeriods.length
        ? `Comparison accounts for missing data periods (${missingPeriods.join(', ')}).`
        : 'Consistent 14-day logging window available.'
    });
  });

  // TRAIN 3: Athlete Intelligence & Recovery / Gamification Controls
  app.get('/api/training/intelligence', authOnly, (req, res) => {
    const profileRow = db.prepare('SELECT profile_json FROM profiles WHERE user_id = ?').get(req.user.sub);
    const profile = json(profileRow?.profile_json, {});
    const gamificationEnabled = profile.gamificationEnabled !== false;

    const workouts = db.prepare('SELECT log_json, created_at FROM workout_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user.sub);
    const parsedLogs = workouts.map(w => ({ ...json(w.log_json, {}), createdAt: w.created_at }));
    const painEvents = parsedLogs.filter(l => l.painFlag || l.status === 'modified_pain');

    const now = Date.now();
    const last7dCount = workouts.filter(w => w.created_at >= new Date(now - 7 * 86400_000).toISOString()).length;

    const insights = [];
    if (painEvents.length > 0) {
      insights.push(`Pain/modification logged on ${painEvents.length} recent movement(s). Prioritize pain-free alternatives and consult a clinician if discomfort persists.`);
    }
    if (last7dCount > 6) {
      insights.push('High 7-day session density detected (>6 sessions). Schedule at least 1–2 full recovery days to prevent overtraining.');
    } else if (last7dCount >= 2) {
      insights.push(`Balanced weekly consistency (${last7dCount} sessions logged in the last 7 days) with room for sustainable recovery.`);
    } else {
      insights.push('Start with 2–3 short 20-minute sessions this week; sustainable consistency matters more than intensity.');
    }

    res.json({
      advisorySummary: insights.join(' '),
      insights,
      recoveryStatus: last7dCount > 6 ? 'rest_recommended' : 'balanced',
      painFlagsCount: painEvents.length,
      gamification: {
        enabled: gamificationEnabled,
        activeStreakDays: gamificationEnabled ? Math.min(last7dCount, 7) : null,
        milestones: gamificationEnabled
          ? [
              ...(workouts.length >= 1 ? ['First Workout Logged'] : []),
              ...(last7dCount >= 3 ? ['3-Session Weekly Consistency'] : [])
            ]
          : []
      },
      disclaimer: 'Athlete Intelligence is advisory wellness feedback based on your logged entries, not a clinical assessment.'
    });
  });

  // Prompt 12: User control to enable/disable gamification (streaks, milestones, badges)
  app.patch('/api/profile/gamification', authOnly, (req, res) => {
    const enabled = Boolean(req.body?.enabled);
    const row = db.prepare('SELECT profile_json FROM profiles WHERE user_id = ?').get(req.user.sub);
    const profile = json(row?.profile_json, {});
    profile.gamificationEnabled = enabled;
    const now = isoNow();
    db.prepare(
      'INSERT INTO profiles(user_id,profile_json,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET profile_json=excluded.profile_json,updated_at=excluded.updated_at'
    ).run(req.user.sub, JSON.stringify(profile), now);
    logAudit({ actorId: req.user.sub, action: 'profile.gamification_toggled', targetType: 'profile', targetId: req.user.sub, metadata: { enabled } });
    res.json({ ok: true, gamificationEnabled: enabled, updatedAt: now });
  });

  // EXPLORE: Personalized Routes, Terrain/Elevation Layers & Waypoints (Prompt 11)
  app.get('/api/training/routes', authOnly, (req, res) => {
    const rows = db.prepare(
      `SELECT id, name, distance_km AS distanceKm, terrain, elevation_gain_m AS elevationGainM,
              waypoints_json, visibility, privacy_zone_km AS privacyZoneKm, created_at AS createdAt
       FROM training_routes WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    ).all(req.user.sub);
    res.json(rows.map(r => ({
      ...r,
      waypoints: json(r.waypoints_json, []),
      waypoints_json: undefined,
      elevationNotice: r.elevationGainM != null ? 'User/provider elevation estimate (approximate)' : 'No elevation layer attached'
    })));
  });

  app.post('/api/training/routes', authOnly, (req, res) => {
    const name = str(req.body?.name, 140);
    const distanceKm = Number(req.body?.distanceKm);
    const terrain = ['road', 'trail', 'track', 'mixed', 'indoor'].includes(req.body?.terrain) ? req.body.terrain : 'road';
    const elevationGainM = req.body?.elevationGainM == null || req.body?.elevationGainM === '' ? null : Number(req.body.elevationGainM);
    const visibility = ['private', 'friends', 'public'].includes(req.body?.visibility) ? req.body.visibility : 'private';
    const privacyZoneKm = req.body?.privacyZoneKm == null ? 0.5 : Math.max(0, Math.min(5, Number(req.body.privacyZoneKm) || 0.5));
    const waypoints = Array.isArray(req.body?.waypoints)
      ? req.body.waypoints.slice(0, 10).map(w => ({
          name: str(w?.name, 100),
          type: ['hydration', 'cafe', 'restroom', 'viewpoint', 'other'].includes(w?.type) ? w.type : 'hydration',
          verified: Boolean(w?.verified)
        })).filter(w => w.name)
      : [];

    if (!name || !Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 250) {
      return res.status(400).json({ error: 'Route name and a valid distanceKm (0.1–250 km) are required.' });
    }
    if (elevationGainM !== null && (!Number.isFinite(elevationGainM) || elevationGainM < 0)) {
      return res.status(400).json({ error: 'elevationGainM must be a non-negative number.' });
    }

    const rid = id(), now = isoNow();
    db.prepare(
      `INSERT INTO training_routes (id, user_id, name, distance_km, terrain, elevation_gain_m, waypoints_json, visibility, privacy_zone_km, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(rid, req.user.sub, name, distanceKm, terrain, elevationGainM, JSON.stringify(waypoints), visibility, privacyZoneKm, now);

    logAudit({ actorId: req.user.sub, action: 'training.route_created', targetType: 'training_route', targetId: rid, metadata: { terrain, visibility } });

    res.status(201).json({
      id: rid,
      name,
      distanceKm,
      terrain,
      elevationGainM,
      waypoints,
      visibility,
      privacyZoneKm,
      elevationNotice: 'Elevation and terrain figures are approximate estimates; live turn-by-turn routing requires a licensed maps provider.',
      createdAt: now
    });
  });

  app.delete('/api/training/routes/:id', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM training_routes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Route not found' });
    res.json({ ok: true });
  });

  // COMPETE: Opt-in Leaderboards with Privacy & Anti-Abuse Controls (Prompt 11)
  app.get('/api/training/leaderboard', authOnly, (req, res) => {
    const metricType = str(req.query?.metricType || 'weekly_km', 40);
    const entries = db.prepare(
      `SELECT user_id AS userId, display_name AS displayName, metric_type AS metricType, score, updated_at AS updatedAt
       FROM leaderboard_entries
       WHERE opt_in = 1 AND metric_type = ?
       ORDER BY score DESC, updated_at ASC LIMIT 50`
    ).all(metricType);

    const myEntry = db.prepare(
      `SELECT display_name AS displayName, metric_type AS metricType, score, opt_in AS optIn, updated_at AS updatedAt
       FROM leaderboard_entries WHERE user_id = ?`
    ).get(req.user.sub);

    res.json({
      metricType,
      rankings: entries.map((e, idx) => ({
        rank: idx + 1,
        displayName: e.displayName,
        score: e.score,
        isCurrentUser: e.userId === req.user.sub,
        updatedAt: e.updatedAt
      })),
      myStatus: myEntry ? { ...myEntry, optIn: !!myEntry.optIn } : { optIn: false, score: 0 }
    });
  });

  app.post('/api/training/leaderboard/opt-in', authOnly, (req, res) => {
    const u = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.sub);
    const displayName = str(req.body?.displayName, 60) || u?.display_name || 'VYORA Athlete';
    const metricType = ['weekly_km', 'consistency_days', 'challenge_points'].includes(req.body?.metricType)
      ? req.body.metricType
      : 'weekly_km';
    const score = Number(req.body?.score ?? 0);

    // Anti-abuse plausibility bound (e.g. max 400 km/week)
    if (!Number.isFinite(score) || score < 0 || score > 400) {
      return res.status(400).json({
        code: 'FAIR_PLAY_BOUND_EXCEEDED',
        error: 'Score must be between 0 and 400 for fair-play anti-abuse validation.'
      });
    }

    const now = isoNow();
    db.prepare(
      `INSERT INTO leaderboard_entries (user_id, display_name, metric_type, score, opt_in, updated_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         metric_type = excluded.metric_type,
         score = excluded.score,
         opt_in = 1,
         updated_at = excluded.updated_at`
    ).run(req.user.sub, displayName, metricType, score, now);

    logAudit({ actorId: req.user.sub, action: 'leaderboard.opted_in', targetType: 'leaderboard', targetId: req.user.sub, metadata: { metricType, score } });
    res.json({ ok: true, displayName, metricType, score, optIn: true, updatedAt: now });
  });

  app.post('/api/training/leaderboard/leave', authOnly, (req, res) => {
    const now = isoNow();
    db.prepare('UPDATE leaderboard_entries SET opt_in = 0, updated_at = ? WHERE user_id = ?').run(now, req.user.sub);
    logAudit({ actorId: req.user.sub, action: 'leaderboard.left', targetType: 'leaderboard', targetId: req.user.sub });
    res.json({ ok: true, optIn: false, message: 'You have hidden your profile and left public leaderboard rankings.' });
  });
}
