/**
 * Stage 10 — Community Hub, Posts, Likes, Comments, Reporting & Admin Moderation Routes
 */
import { db, isoNow } from '../db.js';
import { id, str } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export function registerCommunityAndAdminRoutes(app) {
  app.get('/api/community/posts', authOnly, (req, res) => {
    const rows = db.prepare(
      `SELECT p.id,p.user_id AS userId,p.author_name AS author,p.type,p.title,p.body,p.media_url AS mediaUrl,p.visibility,p.created_at AS createdAt,
       (SELECT COUNT(*) FROM community_interactions i WHERE i.post_id=p.id AND i.kind='like') AS likes,
       (SELECT COUNT(*) FROM community_interactions i WHERE i.post_id=p.id AND i.kind='comment') AS comments,
       (SELECT COUNT(*) FROM community_interactions i WHERE i.post_id=p.id AND i.kind='like' AND i.user_id=?) AS liked
       FROM community_posts p WHERE p.visibility='public' OR p.user_id=? ORDER BY p.created_at DESC LIMIT 100`
    ).all(req.user.sub, req.user.sub);
    res.json(rows.map(x => ({ ...x, liked: !!x.liked })));
  });

  app.post('/api/community/posts', authOnly, (req, res) => {
    const title = str(req.body?.title, 180);
    const body = str(req.body?.body, 5000);
    const type = ['blog', 'article', 'video', 'reel', 'photo'].includes(req.body?.type) ? req.body.type : 'article';
    const mediaUrl = str(req.body?.mediaUrl, 1000);
    const visibility = req.body?.visibility === 'private' ? 'private' : 'public';
    if (!title || !body) return res.status(400).json({ error: 'Post title and content are required.' });
    if (mediaUrl && !/^https:\/\//i.test(mediaUrl)) return res.status(400).json({ error: 'Media URL must use HTTPS.' });
    const u = db.prepare('SELECT display_name FROM users WHERE id=?').get(req.user.sub);
    const pid = id(), now = isoNow();
    db.prepare('INSERT INTO community_posts(id,user_id,author_name,type,title,body,media_url,visibility,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(pid, req.user.sub, u?.display_name || 'VYORA User', type, title, body, mediaUrl || null, visibility, now);
    res.status(201).json({
      id: pid,
      userId: req.user.sub,
      author: u?.display_name || 'VYORA User',
      type,
      title,
      body,
      mediaUrl: mediaUrl || null,
      visibility,
      createdAt: now,
      likes: 0,
      comments: 0,
      liked: false
    });
  });

  app.delete('/api/community/posts/:id', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM community_posts WHERE id=? AND user_id=?').run(req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Post not found or not yours.' });
    res.json({ ok: true });
  });

  app.post('/api/community/posts/:id/like', authOnly, (req, res) => {
    const p = db.prepare("SELECT id FROM community_posts WHERE id=? AND (visibility='public' OR user_id=?)").get(req.params.id, req.user.sub);
    if (!p) return res.status(404).json({ error: 'Post not found' });
    const found = db.prepare("SELECT id FROM community_interactions WHERE post_id=? AND user_id=? AND kind='like'").get(p.id, req.user.sub);
    if (found) db.prepare('DELETE FROM community_interactions WHERE id=?').run(found.id);
    else db.prepare("INSERT INTO community_interactions(id,post_id,user_id,kind,body,created_at) VALUES(?,?,?,'like','',?)").run(id(), p.id, req.user.sub, isoNow());
    res.json({ liked: !found });
  });

  app.get('/api/community/posts/:id/comments', authOnly, (req, res) => res.json(
    db.prepare("SELECT i.id,i.user_id AS userId,u.display_name AS author,i.body,i.created_at AS createdAt FROM community_interactions i JOIN users u ON u.id=i.user_id WHERE i.post_id=? AND i.kind='comment' ORDER BY i.created_at ASC")
      .all(req.params.id)
  ));

  app.post('/api/community/posts/:id/comments', authOnly, (req, res) => {
    const body = str(req.body?.body, 1500);
    if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });
    if (!db.prepare("SELECT id FROM community_posts WHERE id=? AND visibility='public'").get(req.params.id)) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const existingDup = db.prepare(
      "SELECT id, created_at AS createdAt FROM community_interactions WHERE post_id=? AND user_id=? AND kind='comment' AND body=?"
    ).get(req.params.id, req.user.sub, body);
    if (existingDup) {
      return res.status(409).json({
        code: 'DUPLICATE_COMMENT',
        error: 'You have already posted this exact comment on this post.',
        id: existingDup.id
      });
    }
    const cid = id(), now = isoNow();
    db.prepare("INSERT INTO community_interactions(id,post_id,user_id,kind,body,created_at) VALUES(?,?,?,'comment',?,?)")
      .run(cid, req.params.id, req.user.sub, body, now);
    res.status(201).json({ id: cid, body, createdAt: now });
  });

  app.post('/api/community/reports', authOnly, (req, res) => {
    const postId = str(req.body?.postId, 80) || null;
    const reason = str(req.body?.reason, 200);
    const details = str(req.body?.details, 1000) || null;
    if (!reason) return res.status(400).json({ error: 'Report reason is required.' });
    if (postId) {
      const postExists = db.prepare('SELECT id FROM community_posts WHERE id = ?').get(postId);
      if (!postExists) return res.status(404).json({ error: 'Reported post not found.' });
    }
    const repId = id(), now = isoNow();
    db.prepare(
      `INSERT INTO community_reports (id, reporter_id, post_id, reason, details, status, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, NULL)`
    ).run(repId, req.user.sub, postId, reason, details, now);

    logAudit({
      actorId: req.user.sub,
      action: 'community.report_submitted',
      targetType: 'community_report',
      targetId: repId,
      metadata: { postId, reason }
    });

    res.status(201).json({
      id: repId,
      postId,
      reason,
      details,
      status: 'open',
      createdAt: now
    });
  });

  app.get('/api/admin/reports', authOnly, (req, res) => {
    const reports = db.prepare(
      `SELECT id, reporter_id AS reporterId, post_id AS postId, reason, details, status, created_at AS createdAt, resolved_at AS resolvedAt
       FROM community_reports
       ORDER BY created_at DESC LIMIT 100`
    ).all();
    logAudit({ actorId: req.user.sub, action: 'admin.reports_viewed', targetType: 'community_report' });
    res.json(reports);
  });

  app.patch('/api/admin/reports/:id', authOnly, (req, res) => {
    const status = ['open', 'reviewed', 'actioned', 'dismissed', 'resolved'].includes(String(req.body?.status || '').toLowerCase())
      ? String(req.body.status).toLowerCase()
      : null;
    if (!status) return res.status(400).json({ error: 'Valid moderation status is required (open, reviewed, actioned, dismissed, resolved).' });
    const row = db.prepare('SELECT * FROM community_reports WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Report not found.' });
    const now = isoNow();
    const resolvedAt = ['actioned', 'dismissed', 'resolved'].includes(status) ? now : null;
    db.prepare('UPDATE community_reports SET status = ?, resolved_at = ? WHERE id = ?').run(status, resolvedAt, row.id);

    if (req.body?.removePost === true && row.post_id) {
      db.prepare('DELETE FROM community_posts WHERE id = ?').run(row.post_id);
    }

    logAudit({
      actorId: req.user.sub,
      action: 'admin.report_moderated',
      targetType: 'community_report',
      targetId: row.id,
      metadata: { status, removePost: !!req.body?.removePost }
    });

    res.json({ ok: true, id: row.id, status, resolvedAt });
  });
}
