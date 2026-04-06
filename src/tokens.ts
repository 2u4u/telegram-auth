import crypto from 'node:crypto';

export function createTokenStore(maxAgeMs: number) {
  const tokens = new Map<string, { expiresAt: number }>();

  function generate(): string {
    const token = crypto.randomUUID();
    tokens.set(token, { expiresAt: Date.now() + maxAgeMs });
    return token;
  }

  function consume(token: string): boolean {
    const entry = tokens.get(token);
    tokens.delete(token);
    if (!entry || entry.expiresAt < Date.now()) return false;
    return true;
  }

  function cleanup(): void {
    const now = Date.now();
    for (const [t, v] of tokens) {
      if (v.expiresAt < now) tokens.delete(t);
    }
  }

  return { generate, consume, cleanup };
}
