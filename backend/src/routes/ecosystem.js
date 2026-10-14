/**
 * Stage 12 — Partners, Aggregated Campaign Analytics, VYORA Pro Trainers (Sharing, Revocation, Reschedule, Reviews),
 * Special Training Challenges & Local Discovery (Saved Places, Inaccuracy Reporting & Location History Control)
 */
import { db, isoNow } from '../db.js';
import { id, str } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

const ALLOWED_SHARE_SCOPES = ['goals', 'workouts', 'progress', 'diet_plan'];
const ALLOWED_CAMPAIGN_EVENTS = ['impression', 'click', 'opt_in', 'redemption'];

export function registerEcosystemRoutes(app) {
  // ===== Partner Network & Aggregated Campaign Analytics (PRD Prompt 14) =====

  app.get('/api/partners', authOnly, (req, res) => res.json(
    db.prepare("SELECT id,name,category,location,offer,status,created_at AS createdAt FROM partners WHERE status='approved' OR user_id=? ORDER BY created_at DESC")
      .all(req.user.sub)
      .map(p => ({ ...p, sponsoredLabel: p.offer ? 'Partner Promotion' : null }))
  ));

  function handlePartnerApply(req, res) {
    const name = str(req.body?.name, 150), category = str(req.body?.category, 80), location = str(req.body?.location, 240), offer = str(req.body?.offer, 500);
    if (!name || !category || !location) return res.status(400).json({ error: 'Business name, category and location are required.' });
    const pid = id(), now = isoNow();
    db.prepare("INSERT INTO partners(id,user_id,name,category,location,offer,status,created_at) VALUES(?,?,?,?,?,?,'pending',?)")
      .run(pid, req.user.sub, name, category, location, offer || null, now);
    logAudit({ actorId: req.user.sub, action: 'partner.applied', targetType: 'partner', targetId: pid, metadata: { category } });
    res.status(201).json({ id: pid, name, category, location, offer, status: 'pending', createdAt: now });
  }

  app.post('/api/partners', authOnly, handlePartnerApply);
  app.post('/api/partners/apply', authOnly, handlePartnerApply);

  app.get('/api/campaigns', authOnly, (req, res) => {
    const campaigns = db.prepare('SELECT id,name,date,offer,status,created_at AS createdAt FROM campaigns WHERE user_id=? ORDER BY created_at DESC')
      .all(req.user.sub);
    const countStmt = db.prepare(
      `SELECT event_type, COUNT(*) AS cnt FROM campaign_events WHERE campaign_id = ? GROUP BY event_type`
    );
    const enriched = campaigns.map(c => {
      const counts = Object.fromEntries(countStmt.all(c.id).map(r => [r.event_type, r.cnt]));
      return {
        ...c,
        sponsoredDisclosure: 'Sponsored Partner Campaign — Aggregate Analytics Only',
        analytics: {
          impressions: counts.impression || 0,
          clicks: counts.click || 0,
          optIns: counts.opt_in || 0,
          redemptions: counts.redemption || 0,
          identifiableHealthDataShared: false
        }
      };
    });
    res.json(enriched);
  });

  app.post('/api/campaigns', authOnly, (req, res) => {
    const name = str(req.body?.name, 150), date = str(req.body?.date, 10), offer = str(req.body?.offer, 500);
    if (!name) return res.status(400).json({ error: 'Campaign name is required.' });
    // Enforce PRD Prompt 14: partner targeting must never infer medical or menstrual conditions
    const targetingNote = str(req.body?.targeting || '', 200).toLowerCase();
    if (/\b(pcos|endometriosis|period|menstrua|diabetes|pregnancy|medication|disease)\b/.test(targetingNote)) {
      return res.status(400).json({
        code: 'SENSITIVE_TARGETING_PROHIBITED',
        error: 'Partner campaigns may not target or infer sensitive medical or menstrual conditions.'
      });
    }
    const cid = id(), now = isoNow();
    db.prepare("INSERT INTO campaigns(id,user_id,name,date,offer,status,created_at) VALUES(?,?,?,?,?,'draft',?)")
      .run(cid, req.user.sub, name, date || null, offer || null, now);
    res.status(201).json({ id: cid, name, date, offer, status: 'draft', createdAt: now });
  });

  app.patch('/api/campaigns/:id', authOnly, (req, res) => {
    const status = ['draft', 'active', 'paused', 'completed'].includes(req.body?.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ error: 'Invalid campaign status.' });
    const r = db.prepare('UPDATE campaigns SET status=? WHERE id=? AND user_id=?').run(status, req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ ok: true, status });
  });

  app.post('/api/campaigns/:id/events', authOnly, (req, res) => {
    const eventType = str(req.body?.eventType, 30).toLowerCase();
    if (!ALLOWED_CAMPAIGN_EVENTS.includes(eventType)) {
      return res.status(400).json({ error: `eventType must be one of: ${ALLOWED_CAMPAIGN_EVENTS.join(', ')}` });
    }
    const camp = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
    if (!camp) return res.status(404).json({ error: 'Campaign not found' });
    db.prepare('INSERT INTO campaign_events (id, campaign_id, event_type, created_at) VALUES (?, ?, ?, ?)')
      .run(id(), camp.id, eventType, isoNow());
    res.status(201).json({ ok: true, campaignId: camp.id, eventType });
  });

  app.get('/api/campaigns/:id/analytics', authOnly, (req, res) => {
    const camp = db.prepare('SELECT id, name, status FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
    if (!camp) return res.status(404).json({ error: 'Campaign not found' });
    const rows = db.prepare('SELECT event_type, COUNT(*) AS cnt FROM campaign_events WHERE campaign_id = ? GROUP BY event_type').all(camp.id);
    const counts = Object.fromEntries(rows.map(r => [r.event_type, r.cnt]));
    res.json({
      campaignId: camp.id,
      name: camp.name,
      status: camp.status,
      analytics: {
        impressions: counts.impression || 0,
        clicks: counts.click || 0,
        optIns: counts.opt_in || 0,
        redemptions: counts.redemption || 0
      },
      privacyNotice: 'Aggregated campaign metrics only. Identifiable user health or menstrual data is never shared with partners.'
    });
  });

  // ===== VYORA Pro: Human Trainers, Consent-Based Sharing/Revocation, Rescheduling & Reviews (PRD Prompt 15) =====

  app.get('/api/trainers', authOnly, (_req, res) => {
    const trainers = db.prepare('SELECT id,name,specialty,bio,price,verified FROM trainers WHERE active=1 ORDER BY verified DESC,name').all();
    const ratingStmt = db.prepare('SELECT ROUND(AVG(rating), 1) AS avgRating, COUNT(*) AS reviewCount FROM trainer_reviews WHERE trainer_id = ?');
    res.json(trainers.map(t => {
      const r = ratingStmt.get(t.id);
      return {
        ...t,
        verified: !!t.verified,
        avgRating: r?.avgRating || null,
        reviewCount: r?.reviewCount || 0
      };
    }));
  });

  app.get('/api/trainers/shares', authOnly, (req, res) => {
    const rows = db.prepare(
      `SELECT s.id, s.trainer_id AS trainerId, t.name AS trainerName, s.scopes, s.active, s.granted_at AS grantedAt, s.revoked_at AS revokedAt
       FROM trainer_shares s
       JOIN trainers t ON t.id = s.trainer_id
       WHERE s.user_id = ? ORDER BY s.granted_at DESC`
    ).all(req.user.sub);
    res.json(rows.map(r => ({
      ...r,
      scopes: r.scopes.split(',').filter(Boolean),
      active: !!r.active
    })));
  });

  app.post('/api/trainers/:id/share', authOnly, (req, res) => {
    const trainer = db.prepare('SELECT id, name FROM trainers WHERE id = ? AND active = 1').get(req.params.id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    const rawScopes = Array.isArray(req.body?.scopes) ? req.body.scopes : ['goals', 'workouts'];
    const scopes = rawScopes.filter(s => ALLOWED_SHARE_SCOPES.includes(s));
    if (!scopes.length) {
      return res.status(400).json({ error: `Select at least one valid scope (${ALLOWED_SHARE_SCOPES.join(', ')}).` });
    }
    const shareId = id(), now = isoNow();
    db.prepare(
      `INSERT INTO trainer_shares (id, user_id, trainer_id, scopes, active, granted_at, revoked_at)
       VALUES (?, ?, ?, ?, 1, ?, NULL)
       ON CONFLICT(user_id, trainer_id) DO UPDATE SET
         scopes = excluded.scopes,
         active = 1,
         granted_at = excluded.granted_at,
         revoked_at = NULL`
    ).run(shareId, req.user.sub, trainer.id, scopes.join(','), now);

    logAudit({
      actorId: req.user.sub,
      action: 'trainer.share_granted',
      targetType: 'trainer_share',
      targetId: trainer.id,
      metadata: { scopes }
    });

    res.status(201).json({
      ok: true,
      trainerId: trainer.id,
      trainerName: trainer.name,
      scopes,
      active: true,
      grantedAt: now,
      message: `Shared selected scopes (${scopes.join(', ')}) with ${trainer.name}. You can revoke access at any time.`
    });
  });

  app.delete('/api/trainers/:id/share', authOnly, (req, res) => {
    const now = isoNow();
    const r = db.prepare(
      `UPDATE trainer_shares SET active = 0, revoked_at = ? WHERE user_id = ? AND trainer_id = ? AND active = 1`
    ).run(now, req.user.sub, req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'No active share found for this trainer.' });

    logAudit({
      actorId: req.user.sub,
      action: 'trainer.share_revoked',
      targetType: 'trainer_share',
      targetId: req.params.id
    });

    res.json({
      ok: true,
      trainerId: req.params.id,
      active: false,
      revokedAt: now,
      message: 'Trainer access to your shared goals and logs has been revoked immediately.'
    });
  });

  app.get('/api/trainers/:id/reviews', authOnly, (req, res) => {
    const rows = db.prepare(
      `SELECT r.id, u.display_name AS author, r.rating, r.comment, r.created_at AS createdAt
       FROM trainer_reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.trainer_id = ? ORDER BY r.created_at DESC LIMIT 50`
    ).all(req.params.id);
    res.json(rows);
  });

  app.post('/api/trainers/:id/reviews', authOnly, (req, res) => {
    const trainer = db.prepare('SELECT id FROM trainers WHERE id = ? AND active = 1').get(req.params.id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    const rating = Number(req.body?.rating);
    const comment = str(req.body?.comment, 600);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    }
    const revId = id(), now = isoNow();
    db.prepare(
      `INSERT INTO trainer_reviews (id, trainer_id, user_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(trainer_id, user_id) DO UPDATE SET
         rating = excluded.rating,
         comment = excluded.comment,
         created_at = excluded.created_at`
    ).run(revId, trainer.id, req.user.sub, rating, comment || null, now);
    res.status(201).json({ id: revId, trainerId: trainer.id, rating, comment: comment || null, createdAt: now });
  });

  app.get('/api/bookings', authOnly, (req, res) => res.json(
    db.prepare('SELECT b.id,b.trainer_id AS trainerId,t.name AS trainerName,b.requested_at AS requestedAt,b.notes,b.status,b.created_at AS createdAt FROM bookings b JOIN trainers t ON t.id=b.trainer_id WHERE b.user_id=? ORDER BY b.created_at DESC')
      .all(req.user.sub)
  ));

  function handleTrainerBooking(req, res) {
    const trainerId = str(req.body?.trainerId, 100), requestedAt = str(req.body?.requestedAt, 40), notes = str(req.body?.notes, 500);
    if (!db.prepare('SELECT id FROM trainers WHERE id=? AND active=1').get(trainerId)) return res.status(404).json({ error: 'Trainer not found' });
    if (!requestedAt || !Number.isFinite(Date.parse(requestedAt))) return res.status(400).json({ error: 'Provide a valid requested date/time.' });
    const bid = id(), now = isoNow();
    db.prepare("INSERT INTO bookings(id,user_id,trainer_id,requested_at,notes,status,created_at) VALUES(?,?,?,?,?,'requested',?)")
      .run(bid, req.user.sub, trainerId, new Date(requestedAt).toISOString(), notes || null, now);
    logAudit({ actorId: req.user.sub, action: 'trainer.booking_requested', targetType: 'booking', targetId: bid, metadata: { trainerId } });
    res.status(201).json({ id: bid, trainerId, requestedAt: new Date(requestedAt).toISOString(), notes, status: 'requested', createdAt: now });
  }

  app.post('/api/bookings', authOnly, handleTrainerBooking);
  app.post('/api/trainers/bookings', authOnly, handleTrainerBooking);

  app.patch('/api/bookings/:id', authOnly, (req, res) => {
    const existing = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
    if (!existing) return res.status(404).json({ error: 'Booking not found' });
    const requestedAt = req.body?.requestedAt ? new Date(req.body.requestedAt).toISOString() : existing.requested_at;
    const notes = req.body?.notes !== undefined ? str(req.body.notes, 500) : existing.notes;
    db.prepare('UPDATE bookings SET requested_at = ?, notes = ? WHERE id = ? AND user_id = ?')
      .run(requestedAt, notes, existing.id, req.user.sub);
    logAudit({ actorId: req.user.sub, action: 'trainer.booking_rescheduled', targetType: 'booking', targetId: existing.id, metadata: { requestedAt } });
    res.json({ ok: true, id: existing.id, requestedAt, notes, status: existing.status });
  });

  app.delete('/api/bookings/:id', authOnly, (req, res) => {
    const r = db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND user_id=? AND status='requested'").run(req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Pending booking not found' });
    res.json({ ok: true });
  });

  // ===== Group Challenges =====

  app.get('/api/challenges', authOnly, (req, res) => res.json(
    db.prepare('SELECT c.id,c.title,c.goal,c.target,c.unit,c.start_date AS startDate,c.end_date AS endDate,COALESCE(cp.value,0) AS progress FROM challenges c LEFT JOIN challenge_progress cp ON cp.challenge_id=c.id AND cp.user_id=? WHERE c.user_id=? ORDER BY c.created_at DESC')
      .all(req.user.sub, req.user.sub)
  ));

  app.post('/api/challenges', authOnly, (req, res) => {
    const title = str(req.body?.title, 150), goal = str(req.body?.goal, 250), target = Number(req.body?.target), unit = str(req.body?.unit, 40), start = str(req.body?.startDate, 10), end = str(req.body?.endDate, 10);
    if (!title || !goal || !Number.isFinite(target) || target <= 0 || !unit || !start || !end || end < start) {
      return res.status(400).json({ error: 'Title, goal, positive target, unit and valid date range are required.' });
    }
    const cid = id(), now = isoNow();
    db.prepare('INSERT INTO challenges(id,user_id,title,goal,target,unit,start_date,end_date,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(cid, req.user.sub, title, goal, target, unit, start, end, now);
    db.prepare('INSERT INTO challenge_progress(id,challenge_id,user_id,value,updated_at) VALUES(?,?,?,?,?)')
      .run(id(), cid, req.user.sub, 0, now);
    res.status(201).json({ id: cid, title, goal, target, unit, startDate: start, endDate: end, progress: 0 });
  });

  app.patch('/api/challenges/:id/progress', authOnly, (req, res) => {
    const value = Number(req.body?.value);
    if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'Progress must be a non-negative number.' });
    const ownChallenge = db.prepare('SELECT id FROM challenges WHERE id=? AND user_id=?').get(req.params.id, req.user.sub);
    if (!ownChallenge) return res.status(404).json({ error: 'Challenge not found' });
    db.prepare('INSERT INTO challenge_progress(id,challenge_id,user_id,value,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(challenge_id,user_id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at')
      .run(id(), req.params.id, req.user.sub, value, isoNow());
    res.json({ ok: true, value });
  });

  // ===== Local Discovery: Saved Places, Inaccuracy Reporting & Location History Control (PRD Prompt 16) =====

  app.get('/api/places', authOnly, (req, res) => res.json(
    db.prepare('SELECT id,name,category,address,lat,lng,created_at AS createdAt FROM saved_places WHERE user_id=? ORDER BY created_at DESC')
      .all(req.user.sub)
  ));

  app.post('/api/places', authOnly, (req, res) => {
    const name = str(req.body?.name, 150), category = str(req.body?.category, 80), address = str(req.body?.address, 300);
    const lat = req.body?.lat == null ? null : Number(req.body.lat);
    const lng = req.body?.lng == null ? null : Number(req.body.lng);
    if (!name || !category) return res.status(400).json({ error: 'Place name and category are required.' });
    if ((lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) {
      return res.status(400).json({ error: 'Invalid coordinates.' });
    }
    const pid = id(), now = isoNow();
    db.prepare('INSERT INTO saved_places(id,user_id,name,category,address,lat,lng,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(pid, req.user.sub, name, category, address || null, lat, lng, now);
    res.status(201).json({ id: pid, name, category, address, lat, lng, createdAt: now });
  });

  app.post('/api/places/:id/report', authOnly, (req, res) => {
    const place = db.prepare('SELECT id FROM saved_places WHERE id = ?').get(req.params.id);
    if (!place) return res.status(404).json({ error: 'Place not found' });
    const issue = str(req.body?.issue, 300);
    if (!issue) return res.status(400).json({ error: 'Describe the listing inaccuracy to report.' });
    const repId = id(), now = isoNow();
    db.prepare('INSERT INTO place_reports (id, place_id, user_id, issue, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(repId, place.id, req.user.sub, issue, now);
    logAudit({ actorId: req.user.sub, action: 'place.inaccuracy_reported', targetType: 'place', targetId: place.id, metadata: { issue } });
    res.status(201).json({ id: repId, placeId: place.id, issue, createdAt: now, message: 'Place inaccuracy reported.' });
  });

  app.delete('/api/places/:id', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM saved_places WHERE id=? AND user_id=?').run(req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Place not found' });
    res.json({ ok: true });
  });

  app.delete('/api/places', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM saved_places WHERE user_id = ?').run(req.user.sub);
    logAudit({ actorId: req.user.sub, action: 'place.history_cleared', targetType: 'place', metadata: { deletedCount: r.changes } });
    res.json({ ok: true, deletedPlaces: r.changes, message: 'Saved location history cleared.' });
  });
}
