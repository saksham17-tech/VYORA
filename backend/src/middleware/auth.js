import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (
  process.env.NODE_ENV === 'production' &&
  (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === 'replace-with-a-long-random-secret-before-deployment')
) {
  throw new Error('Set a unique JWT_SECRET of at least 32 characters in production.');
}

export const secret = JWT_SECRET || 'local-development-secret-not-for-production-0123456789';

export function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'Session expired. Refresh the page to start a new guest session.' });
  }
  try {
    const payload = jwt.verify(token, secret);
    if (payload.jti) {
      const revoked = db.prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?').get(payload.jti);
      if (revoked) return res.status(401).json({ error: 'Session has been revoked.' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

export const authOnly = auth;
