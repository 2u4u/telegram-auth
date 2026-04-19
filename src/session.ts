import crypto from 'node:crypto';
import type { Response } from 'express';

export type SessionValidation =
  | { valid: true; chatId: string }
  | { valid: false };

export function createSessionManager(secret: string, cookieName: string, maxAgeMs: number) {
  function sign(chatId: string, ts: number): string {
    return crypto.createHmac('sha256', secret).update(`${chatId}:${ts}`).digest('hex');
  }

  function validate(cookieValue: string | undefined): SessionValidation {
    if (!cookieValue) return { valid: false };
    const parts = cookieValue.split(':');
    if (parts.length !== 3) return { valid: false };
    const [chatId, tsStr, sig] = parts;
    if (!chatId) return { valid: false };
    const ts = parseInt(tsStr, 10);
    if (isNaN(ts) || Date.now() - ts > maxAgeMs) return { valid: false };
    if (sig !== sign(chatId, ts)) return { valid: false };
    return { valid: true, chatId };
  }

  function set(res: Response, chatId: string): void {
    const ts = Date.now();
    const value = `${chatId}:${ts}:${sign(chatId, ts)}`;
    res.setHeader(
      'Set-Cookie',
      `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    );
  }

  return { validate, set };
}
