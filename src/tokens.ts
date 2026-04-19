import crypto from 'node:crypto';

export type TokenConsumeResult =
  | { valid: true; chatId: string }
  | { valid: false };

export function createTokenStore(maxAgeMs: number) {
  const tokens = new Map<string, { chatId: string; expiresAt: number }>();

  function generate(chatId: string): string {
    const token = crypto.randomUUID();
    tokens.set(token, { chatId, expiresAt: Date.now() + maxAgeMs });
    return token;
  }

  function consume(token: string): TokenConsumeResult {
    const entry = tokens.get(token);
    tokens.delete(token);
    if (!entry || entry.expiresAt < Date.now()) return { valid: false };
    return { valid: true, chatId: entry.chatId };
  }

  function cleanup(): void {
    const now = Date.now();
    for (const [t, v] of tokens) {
      if (v.expiresAt < now) tokens.delete(t);
    }
  }

  return { generate, consume, cleanup };
}
