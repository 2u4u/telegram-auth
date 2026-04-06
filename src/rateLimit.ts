import type { Request } from 'express';

export function createRateLimiter(max: number, windowMs: number) {
  const attempts = new Map<string, number[]>();

  function getIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return (req.headers['x-real-ip'] as string) ?? req.socket.remoteAddress ?? 'unknown';
  }

  function isLimited(ip: string): boolean {
    const now = Date.now();
    const prev = (attempts.get(ip) ?? []).filter(t => now - t < windowMs);
    attempts.set(ip, prev);
    if (prev.length >= max) return true;
    prev.push(now);
    return false;
  }

  return { getIp, isLimited };
}
