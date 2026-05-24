# shared-auth

Telegram-based passwordless auth for Express + nginx projects.

**Not a library. Not a service. An inline copy.**

Copy `src/` into your project and import directly. No package dependency, no cross-repo CI wiring, no lockfile pain. If you fix a bug, copy it to other projects manually.

---

## How it works

1. User visits a protected page → nginx `auth_request` hits `/api/auth/check`
2. No valid session cookie → nginx returns 302 to `/login.html`
3. User clicks "Send login link" → `POST /api/auth/request` → server generates a UUID token and sends a Telegram message with `APP_URL/api/auth/login/<token>`
4. User taps the link → `GET /api/auth/login/<token>` → token consumed, HMAC-signed session cookie set, redirect to `/`
5. All subsequent requests pass the cookie; `/api/auth/check` returns 200

No passwords. No email. Telegram is the identity provider.

---

## Features

- One-time login links via Telegram (2h TTL)
- HMAC-signed session cookies (no DB, no Redis)
- Per-IP rate limiting (in-memory, 3 requests / 10 min by default)
- IP geolocation in Telegram message (via ip-api.com, optional)
- `AUTH_ENABLED` flag — enabled when at least one chat ID is configured
- Static bypass tokens via `Authorization: Bearer <token>` (for iOS Shortcuts / automation)

---

## Files

```
src/
  index.ts      — createTelegramAuth() factory, all 4 routes
  types.ts      — TelegramAuthConfig + TelegramAuth interfaces
  session.ts    — HMAC cookie sign/validate/set
  tokens.ts     — in-memory one-time token store
  rateLimit.ts  — per-IP rate limiter
  geo.ts        — IP geolocation via ip-api.com
  telegram.ts   — managed login-message endpoint + broadcast
  cookies.ts    — cookie header parser
```

---

## Location convention

Auth code must always live at **`src/auth/`** inside the project's API source, and always imported as `'./auth/index.js'`. This is not optional — the consistent path is what makes library syncing trivial.

```
<project>/
  <project>-api/
    src/
      auth/          ← always here, always this name
        index.ts
        types.ts
        session.ts
        tokens.ts
        rateLimit.ts
        geo.ts
        telegram.ts
        cookies.ts
      auth.ts        ← thin wrapper: createTelegramAuth({ ... })
      index.ts
```

## Syncing

**Library → project** (update a project to latest auth):
```bash
cp -r ~/projects/telegram-auth/src/* <project-api>/src/auth/
```

**Project → library** (you fixed a bug in a project, save it back):
```bash
cp -r <project-api>/src/auth/* ~/projects/telegram-auth/src/
```

The paths are always the same. No find-and-replace, no manual diffing.

---

## Adding to a project

**1. Copy the source**

```bash
cp -r ~/projects/telegram-auth/src/ <project-api>/src/auth/
```

**2. Import in your Express app**

```typescript
// src/auth.ts
import { createTelegramAuth } from './auth/index.js';

const auth = createTelegramAuth({
  cookieName: 'myapp_session',           // unique per app
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatIds: [process.env.TELEGRAM_CHAT_ID ?? ''].filter(Boolean),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET,
  appName: 'My App',
  sessionMaxAge: 24 * 60 * 60_000,
});

export const { router: authRouter, requireSession, AUTH_ENABLED } = auth;
```

**3. Mount in Express**

```typescript
// src/index.ts
app.use('/api/auth', authRouter);
```

**4. Add env vars** (in `.env` / `.env.myapp-api` on the Pi)

```
# TELEGRAM_BOT_TOKEN is deprecated and ignored by the managed sender.
TELEGRAM_CHAT_ID=<your chat id>
SESSION_SECRET=<random string>
APP_URL=https://myapp.usmanov.me
```

**5. Add `login.html`** to the web app's `public/` directory
Copy from `muhasib/muhasib-web/public/login.html` and update the title/branding.

**6. Configure nginx** — copy the auth_request pattern from `muhasib/nginx.conf`:

```nginx
location = /login.html { add_header Cache-Control "no-cache"; }
location @login { return 302 /login.html; }
location / {
    auth_request /api/auth/check;
    error_page 401 = @login;
    try_files $uri $uri/ /index.html;
}
```

**7. No changes to Dockerfile or CI** — the auth files are just TypeScript source in your project.

---

## Routes mounted by authRouter

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/check` | 200 if valid session, 401 if not — used by nginx `auth_request` |
| `GET` | `/status` | `{ authenticated, authEnabled }` — for frontend polling |
| `POST` | `/request` | Generate token, send Telegram link. Rate-limited per IP. |
| `GET` | `/login/:token` | Consume token, set session cookie, redirect to `/` |

---

## Config options

| Option | Required | Default | Notes |
|--------|----------|---------|-------|
| `cookieName` | ✅ | — | Unique per app, e.g. `muhasib_session` |
| `botToken` | — | — | Deprecated and ignored; login messages use the managed sender |
| `chatIds` | ✅ | — | Array of chat IDs to broadcast login links to |
| `appUrl` | ✅ | — | Public URL, used to build the login link |
| `sessionSecret` | — | auto-generated | Set in env or sessions reset on restart |
| `appName` | — | `'App'` | Shown in the Telegram message |
| `sessionMaxAge` | — | 24h | Session cookie lifetime in ms |
| `tokenMaxAge` | — | 2h | One-time token lifetime in ms |
| `rateLimit` | — | 3/10min | Per-IP rate limit for `/request` |
| `geoLookup` | — | `true` | Include IP location in Telegram message |
| `staticTokens` | — | `[]` | Bypass tokens accepted as `Authorization: Bearer <token>` |

---

## Current usage

| Project | Cookie | Notes |
|---------|--------|-------|
| muhasib | `muhasib_session` | Reference implementation — copy from here |
| sms-parser | `sms_session` | Pending migration to inline copy |
| kalem | `kalem_session` | Pending migration to inline copy |
