/**
 * Stage 10 — Request Context (`X-Request-Id`) & Safe Error Handler Middleware
 * Implements PRD Prompt 20 observability and error-handling requirements:
 * - Attaches a unique `X-Request-Id` to every request and response
 * - Never leaks stack traces, model prompts, or provider secrets in error responses
 */
import { id } from '../utils/helpers.js';

export function requestContext(req, res, next) {
  const reqId = req.headers['x-request-id']
    ? String(req.headers['x-request-id']).slice(0, 64)
    : id();
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

export function errorHandler(err, req, res, _next) {
  const status = Number(err?.status || err?.statusCode) || 500;
  const code = err?.code || (status === 400 ? 'BAD_REQUEST' : status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR');
  const safeMessage = status < 500 && err?.message
    ? err.message
    : 'An unexpected server error occurred.';
  res.status(status).json({
    code,
    error: safeMessage,
    requestId: req.requestId || null
  });
}
