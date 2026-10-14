/**
 * VYORA Stage 10 — Application Bootstrap
 * Includes strict CSP, CORS, rate-limiting, `X-Request-Id` context middleware,
 * modular domain routes, static frontend serving, and safe error handling.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestContext, errorHandler } from './middleware/requestContext.js';
import { registerApiRoutes } from './routes/api.js';
import { registerHealthRoutes } from './routes/health.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../');
export const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(requestContext);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((x) => x.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origins.includes('*') || origins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

// Domain routes
registerHealthRoutes(app);
registerApiRoutes(app);

// Static frontend
app.use(express.static(path.join(root, 'frontend/public')));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'frontend/public/index.html')));

// Safe error handler (never leaks stack traces)
app.use(errorHandler);

if (process.env.VYORA_NO_LISTEN !== '1') {
  app.listen(PORT, () => {
    console.log(`VYORA listening on http://localhost:${PORT}`);
  });
}
