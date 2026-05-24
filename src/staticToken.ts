import type { Request } from 'express';

const BEARER_PREFIX = 'Bearer ';

export function getStaticBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string') return null;
  if (!authorization.startsWith(BEARER_PREFIX)) return null;

  const token = authorization.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}
