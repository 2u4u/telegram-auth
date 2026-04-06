import crypto from 'node:crypto';
import type { Response } from 'express';

export function createSessionManager(secret: string, cookieName: string, maxAgeMs: number) {
  function sign(ts: number): string {
    return crypto.createHmac('sha256', secret).update(String(ts)).digest('hex');
  }

  function validate(cookieValue: string | undefined): boolean {
    if (!cookieValue) return false;
    const idx = cookieValue.indexOf(':');
    if (idx === -1) return false;
    const ts = parseInt(cookieValue.slice(0, idx), 10);
    const sig = cookieValue.slice(idx + 1);
    if (isNaN(ts) || Date.now() - ts > maxAgeMs) return false;
    return sig === sign(ts);
  }

  function set(res: Response): void {
    const ts = Date.now();
    const value = `${ts}:${sign(ts)}`;
    res.setHeader(
      'Set-Cookie',
      `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    );
  }

  return { validate, set };
}
