export interface TelegramAuthConfig {
  /** Cookie name, unique per app (e.g. 'sms_session', 'kalem_session') */
  cookieName: string;
  /** Deprecated: ignored. Login messages are sent through the managed message endpoint. */
  botToken?: string;
  /** Chat IDs to send login links to. Supports multiple (broadcast). */
  chatIds: string[];
  /** Public app URL, used to build the login link (no trailing slash) */
  appUrl: string;
  /** HMAC secret for signing session cookies. Auto-generated if omitted (resets on restart). */
  sessionSecret?: string;
  /** App name shown in the Telegram login message */
  appName?: string;
  /** Session cookie max age in ms. Default: 24 hours */
  sessionMaxAge?: number;
  /** Whether to add the Secure attribute to the session cookie. Default: false */
  secureCookie?: boolean;
  /** One-time token max age in ms. Default: 2 hours */
  tokenMaxAge?: number;
  /** Rate limit for login requests. Default: 3 per 10 minutes per IP */
  rateLimit?: { max: number; windowMs: number };
  /** Whether to look up IP geolocation and include it in the Telegram message. Default: true */
  geoLookup?: boolean;
  /** Static bypass tokens accepted as ?token= query param (for automated clients like iOS Shortcuts) */
  staticTokens?: string[];
  /** Called on successful login token request (before Telegram send) */
  onLoginRequest?: (ip: string, ua: string, geo: string) => void;
  /** Called on successful token verification (session created) */
  onSessionCreated?: (ip: string, ua: string) => void;
  /** Called on rejected token (expired or invalid) */
  onInvalidToken?: (ip: string, token: string) => void;
}

export interface TelegramAuth {
  /** Express router mounting POST /request, GET /login/:token, GET /check, GET /status */
  router: import('express').Router;
  /** Express middleware requiring a valid session. Passes through if auth is disabled. */
  requireSession: import('express').RequestHandler;
  /** Whether auth is enabled (chatIds configured) */
  AUTH_ENABLED: boolean;
  /**
   * Generate a one-time login link and send it to a specific chat.
   * Useful for bot /login commands.
   */
  sendLoginLink: (chatId: string) => Promise<string>;
  /**
   * Returns the chatId from the session cookie, or null when no valid session.
   * Static-token (?token=) requests are intentionally treated as anonymous and
   * return null — callers needing a chatId for those should resolve it
   * separately (e.g. via a token→chatId mapping env var).
   */
  getSessionChatId: (req: import('express').Request) => string | null;
}
