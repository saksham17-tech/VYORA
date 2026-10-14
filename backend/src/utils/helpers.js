import crypto from 'node:crypto';

export const id = () => crypto.randomUUID();
export const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
export const validTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const json = (v, fallback = {}) => {
  try { return JSON.parse(v); } catch { return fallback; }
};
