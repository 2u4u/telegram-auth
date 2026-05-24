import crypto from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TelegramAuthConfig, TelegramAuth } from './types.js';
import { parseCookies } from './cookies.js';
import { createSessionManager } from './session.js';
import { createTokenStore } from './tokens.js';
import { createRateLimiter } from './rateLimit.js';
import { lookupGeo } from './geo.js';
import { broadcastLoginLink, sendTelegramMessage } from './telegram.js';

export type { TelegramAuthConfig, TelegramAuth } from './types.js';

const EXPIRED_HTML =
  '<html><body style="background:#0a0a0a;color:#999;font-family:system-ui;' +
  'display:flex;align-items:center;justify-content:center;height:100vh;margin:0">' +
  '<div style="text-align:center">' +
  '<h2 style="color:#f87171">Link expired or already used</h2>' +
  '<p>Go back to <a href="/" style="color:#60a5fa">the app</a> to request a new one.</p>' +
  '</div></body></html>';

export function createTelegramAuth(config: TelegramAuthConfig): TelegramAuth {
  const {
    cookieName,
    botToken,
    chatIds,
    appUrl,
    appName = 'App',
    sessionMaxAge = 24 * 60 * 60_000,
    secureCookie = false,
    devBypass = false,
    tokenMaxAge = 2 * 60 * 60_000,
    rateLimit: rateLimitConfig = { max: 3, windowMs: 10 * 60_000 },
    geoLookup = true,
    staticTokens = [],
    onLoginRequest,
    onSessionCreated,
    onInvalidToken,
  } = config;

  const sessionSecret =
    config.sessionSecret ?? (() => {
      console.warn('[telegram-auth] sessionSecret not set — sessions will reset on restart');
      return crypto.randomBytes(32).toString('hex');
    })();

  const AUTH_ENABLED = chatIds.length > 0;
  const warnings = devBypass ? ['auth-dev-bypass-active'] : [];

  if (AUTH_ENABLED) {
    console.log(`[telegram-auth] enabled — login links sent via managed message endpoint for ${chatIds.length} chat(s)`);
  } else {
    console.warn('[telegram-auth] not configured — set chatIds to enable login links');
  }

  if (devBypass) {
    console.warn('[telegram-auth] WARNING: development auth bypass is active');
  }

  const session = createSessionManager(sessionSecret, cookieName, sessionMaxAge, secureCookie);
  const tokenStore = createTokenStore(tokenMaxAge);
  const rateLimiter = createRateLimiter(rateLimitConfig.max, rateLimitConfig.windowMs);
  const normalizedAppUrl = appUrl.replace(/\/$/, '');

  function getSessionChatId(req: Request): string | null {
    const cookies = parseCookies(req.headers.cookie);
    const result = session.validate(cookies[cookieName]);
    return result.valid ? result.chatId : null;
  }

  function hasValidSession(req: Request): boolean {
    if (devBypass) {
      console.warn('[telegram-auth] WARNING: development auth bypass accepted request');
      return true;
    }
    if (getSessionChatId(req) !== null) return true;
    if (staticTokens.length > 0 && typeof req.query['token'] === 'string') {
      return staticTokens.includes(req.query['token']);
    }
    return false;
  }

  function requireSession(req: Request, res: Response, next: NextFunction): void {
    if (hasValidSession(req)) { next(); return; }
    res.status(401).json({ error: 'Unauthorized' });
  }

  async function sendLoginLink(chatId: string): Promise<string> {
    tokenStore.cleanup();
    const token = tokenStore.generate(chatId);
    const loginUrl = `${normalizedAppUrl}/api/auth/login/${token}`;
    const text = `🔐 ${appName} login link\n\n${loginUrl}\n\nValid for 2 hours. One-time use.`;
    const ok = await sendTelegramMessage(botToken, chatId, text);
    if (!ok) throw new Error(`Failed to send login link to chat ${chatId}`);
    return loginUrl;
  }

  const router = Router();

  // nginx auth_request subrequest — 200 = allow, 401 = deny
  router.get('/check', (req: Request, res: Response) => {
    res.sendStatus(hasValidSession(req) ? 200 : 401);
  });

  // Session status for frontend polling
  router.get('/status', (req: Request, res: Response) => {
    const authenticated = hasValidSession(req);

    res.json({
      auth: AUTH_ENABLED ? (authenticated ? 'authenticated' : 'required') : 'not-configured',
      authenticated,
      authEnabled: AUTH_ENABLED,
      warnings,
    });
  });

  // Generate one-time token, send login link via Telegram
  router.post('/request', async (req: Request, res: Response) => {
    if (!AUTH_ENABLED) {
      res.status(503).json({ auth: 'not-configured', error: 'Auth not configured' });
      return;
    }

    const ip = rateLimiter.getIp(req);
    const ua = req.headers['user-agent'] ?? 'unknown';

    if (rateLimiter.isLimited(ip)) {
      console.warn(`[telegram-auth] rate-limited login request from ${ip}`);
      res.status(429).json({ error: 'Too many requests. Try again later.' });
      return;
    }

    const geo = geoLookup ? await lookupGeo(ip) : '';
    console.log(`[telegram-auth] login requested — IP: ${ip}${geo ? ` (${geo})` : ''} | UA: ${ua}`);

    tokenStore.cleanup();

    // Generate a chat-bound token per recipient so the resulting session
    // carries the clicker's chatId.
    const buildLoginUrl = (chatId: string) =>
      `${normalizedAppUrl}/api/auth/login/${tokenStore.generate(chatId)}`;

    const sent = await broadcastLoginLink(botToken, chatIds, appName, buildLoginUrl, ip, ua, geo);

    if (sent === 0) {
      res.status(502).json({ error: 'Failed to send login link' });
      return;
    }

    onLoginRequest?.(ip, ua, geo);
    res.json({ ok: true });
  });

  // Verify one-time token → set session cookie → redirect to app
  router.get('/login/:token', (req: Request<{ token: string }>, res: Response) => {
    const ip = rateLimiter.getIp(req);
    const ua = req.headers['user-agent'] ?? 'unknown';
    const token = req.params.token;

    if (!AUTH_ENABLED) {
      res.status(503).json({ auth: 'not-configured', error: 'Auth not configured' });
      return;
    }

    const consumed = tokenStore.consume(token);
    if (!consumed.valid) {
      console.warn(`[telegram-auth] invalid/expired token from ${ip}`);
      onInvalidToken?.(ip, token);
      res.status(401).send(EXPIRED_HTML);
      return;
    }

    session.set(res, consumed.chatId);
    console.log(`[telegram-auth] session created — chat ${consumed.chatId} | IP: ${ip} | UA: ${ua}`);
    onSessionCreated?.(ip, ua);
    res.redirect('/');
  });

  return { router, requireSession, AUTH_ENABLED, warnings, sendLoginLink, getSessionChatId };
}
