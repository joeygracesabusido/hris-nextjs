# IJESoft HRIS — PWA v1 Design (Installable + Safe App-Shell Offline)

**Date:** 2026-09-13
**Status:** Approved design (user approved 2026-09-13, "proceed")
**Scope:** Single implementation plan. Phase 2 (offline queue, push) explicitly out of scope.
**Stack context:** Next.js 14 (App Router, React 18), MongoDB + Prisma, Radix/shadcn + Tailwind (dark glass theme), cookie auth + NextAuth Google bridge, Cloudflare deployment via `@cloudflare/next-on-pages` (`wrangler.jsonc`).

## 1. Context & constraints

- No PWA assets exist today: `public/` contains only `models/` (face-api weights). No manifest, no service worker (SW), no app icons.
- Auth is cookie-based (`isLoggedIn/userId/userRole/userEmail/userName`); `middleware.ts` redirects unauthenticated navigations to `/login`. NextAuth endpoints under `/api/auth/*` must stay public (Google OAuth flow).
- Deployment target is Cloudflare (Workers/Pages via `next-on-pages`). SW must be served from site root (`/sw.js`, scope `/`) with correct JS MIME, and must survive the Cloudflare build output copy.
- `next-pwa` is unmaintained; the maintained successor for Next.js is **Serwist** (`@serwist/next`). This spec mandates Serwist, not `next-pwa`, not a hand-rolled precache manifest.
- Do-not-regress (from AGENTS.md): IJESoft branding, dark glass theme, PH payroll standards (`lib/ph-standards.ts`), TRAIN/SSS/Holiday/13th-month logic, Google SSO cookie bridge, admin-driven password reset, dark-mode input visibility fixes, `middleware.ts` public paths for `/api/auth/*`, `/auth/sync`, `/login`, `/register`, `/forgot-password`.

## 2. Decision

**Option B — Installable + safe app-shell offline.** Rejected: (A) manifest + dummy SW — fails Chrome installability expectations and gives no offline UX; (C) full offline-first with queued clock in/out + push — 3–5x scope, needs conflict resolution and Manila-timezone correctness work, deferred to Phase 2.

## 3. Architecture

```
Browser
 ├─ manifest.webmanifest (installability, shortcuts, icons)
 ├─ /sw.js (Serwist-generated; prod only, root scope)
 │   ├─ precache: versioned build assets (_next/static, fonts)
 │   ├─ NetworkFirst + timeout → /offline : navigations (GET, HTML)
 │   ├─ StaleWhileRevalidate            : static assets, Google fonts
 │   └─ NetworkOnly                     : /api/*, /api/auth/*, /login POSTs, face-api models
 ├─ components/pwa-register.tsx (registers /sw.js, prod only; update toast)
 └─ components/pwa-install-prompt.tsx (beforeinstallprompt UI + iOS hint)
Next.js 14
 ├─ app/layout.tsx — Metadata API: manifest, themeColor, appleWebApp, viewport-fit=cover
 ├─ app/offline/page.tsx — offline fallback (public route)
 └─ middleware.ts — bypass SW/manifest/icons/offline from login redirect
Cloudflare (next-on-pages)
 └─ public/sw.js + manifest + icons copied to output; verified MIME + root scope
```

## 4. Components (one purpose each)

1. **Web manifest** (`public/manifest.webmanifest`). Purpose: installability metadata. Contents: `name: IJESoft HRIS`, `short_name: IJESoft`, `description` matching layout metadata, `id: /`, `start_url: /dashboard`, `scope: /`, `display: standalone`, `orientation: portrait`, `theme_color: #050914`, `background_color: #050914`, `categories: [business, productivity]`, `shortcuts`: Time Logs (`/time-logs`, icon 192) and Payroll (`/payroll`, icon 192), `icons`: 192-any, 192-maskable, 512-any, 512-maskable (PNG), plus 180 apple-touch referenced from metadata, `screenshots`: deferred (single 1280x720 desktop screenshot may be added opportunistically; not a blocker).
2. **Icon set** (`public/icons/`). Purpose: install + maskable + iOS coverage. Source: new `public/icons/icon.svg` — rounded-square glass tile, deep-navy `#050914` background, blue→cyan gradient glyph "IJE" (no official logo exists in repo; `image/` holds only `shcedule.png`). Exports: `icon-192.png` (any), `icon-maskable-192.png` (safe-zone padded), `icon-512.png` (any), `icon-maskable-512.png`, `apple-touch-icon.png` (180), `favicon.ico` (multi-size, replaces default). All PNGs exported from the SVG at exact pixel sizes via a one-off `sharp`-based `tsx` script run once locally (script itself is throwaway, not committed); the SVG source plus generated PNGs are committed. If an official logo is supplied later, re-export from it.
3. **Root metadata** (`app/layout.tsx`). Purpose: wire manifest + theme + iOS without raw `<head>`. Changes only: `metadata.manifest = '/manifest.webmanifest'`, `metadata.themeColor = [{ media: '(prefers-color-scheme: dark)', color: '#050914' }, { media: '(prefers-color-scheme: light)', color: '#050914' }]` (single brand color both schemes to match dark glass), `metadata.appleWebApp = { capable: true, title: 'IJESoft', statusBarStyle: 'black-translucent' }`, `metadata.icons = { icon: [...192, ...512], apple: ['/icons/apple-touch-icon.png'] }`, `metadata.viewport.viewportFit = 'cover'`. No other layout changes.
4. **Service worker** (`app/sw.ts` via `@serwist/next`, output `/sw.js`). Purpose: versioned offline shell with zero authenticated-data caching. Strategies:
   - Precache: Serwist build manifest (JS/CSS/worker chunks) only.
   - Navigations (HTML GET): NetworkFirst, timeout 3000ms, fallback to precached `/offline`. Never serve a cached copy of another authenticated page.
   - `_next/static/*`, fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), `public/icons/*`: StaleWhileRevalidate (or CacheFirst with 30-day expiry for immutable hashed assets).
   - NetworkOnly (never cache, pass through): `/api/*` (covers `/api/auth/*`, payroll, time-logs, leaves, overtime, users, employees, dashboard, advances, shifts, schedules), `POST/PUT/DELETE` everything, `/login`, `/register`, `/forgot-password` submissions, `public/models/*` (face-api weights load on demand; caching large model blobs in v1 is rejected to avoid storage pressure).
   - `skipWaiting` + `clientsClaim` with user-visible update flow (see §6), not silent force-reload.
5. **Registration** (`components/pwa-register.tsx`, client). Purpose: register SW in production only (`process.env.NODE_ENV === 'production'`), listen for Serwist update event, surface "New version available — Refresh" action through existing shadcn `Toaster`. Rendered once in root layout. No-op in `next dev`.
6. **Install prompt** (`components/pwa-install-prompt.tsx`, client). Purpose: humane install UX. Captures `beforeinstallprompt`, persists event, exposes an "Install app" button placed on login page + sidebar footer; on click calls `prompt()` and logs choice (no analytics backend; `console.info` only). iOS detection (no `beforeinstallprompt`): shows one-line "Share → Add to Home Screen" hint. Dismiss persists to `localStorage` (`ijesoft-pwa-dismissed=1`).
7. **Offline fallback** (`app/offline/page.tsx`). Purpose: branded dead-end instead of browser error. Dark-glass card matching theme, message "You're offline", "Retry" button (`window.location.reload()`), note "Clock in/out and payroll need a connection in this version." Route is public (see §5) and precached by SW at install/activate.
8. **Middleware bypass** (`middleware.ts`). Purpose: keep SW/manifest/installability working behind cookie auth. Add early-return `NextResponse.next()` for exact/prefix matches: `/sw.js`, `/sw.js.map`, `/manifest.webmanifest`, `/icons/*`, `/offline`, `/favicon.ico` (existing matcher already excludes `_next/static`, `_next/image`, `favicon.ico`; keep those). No change to existing public paths or API pass-throughs.

## 5. Data flow

- **Install:** browser fetches `/manifest.webmanifest` + `/sw.js` (both public, no cookie) → validates 192/512 icons + fetch handler → enables install prompt.
- **Online navigation:** SW NetworkFirst tries network (cookies attached normally) → middleware auth as today → page renders. No behavioral change.
- **Offline navigation:** network fails/timeout → SW serves precached `/offline`. No API call attempted from fallback. Auth state untouched.
- **Update:** new build → new precache manifest → SW `waiting` → toast prompts refresh → `skipWaiting` → `clientsClaim` → reload once.
- **Uninstall/disable:** removing SW registration returns app to plain web app; no data migration (nothing app-specific stored by SW in v1).

## 6. Error handling

- SW registration failure (non-HTTPS preview, private mode): caught, `console.warn`, app runs as normal website. No user-facing error.
- Manifest/icon 404: build-time check (`npm run build` + manifest fetch test) prevents ship; runtime needs no handling.
- Stale-content complaints: mitigated by NetworkFirst navigations + explicit update toast; support path is "Refresh via toast."
- Middleware misconfiguration (SW redirected to `/login`): prevented by §4.8 bypass list + verification step that asserts HTTP 200 + `content-type: application/manifest+json` for manifest and `application/javascript` for SW without redirect when logged out.
- Cloudflare output missing SW: build verification lists output assets; fallback is committing a static `public/sw.js` minimal NetworkFirst shell only if Serwist output is dropped (decision logged in plan; default remains Serwist).

## 7. Testing & acceptance

- `npm run lint` clean; `npm run build` succeeds; `next-on-pages` output contains `/sw.js`, `/manifest.webmanifest`, `/icons/*`.
- Logged-out `curl` checks: manifest, SW, icons, `/offline` all HTTP 200, correct MIME, no redirect to `/login`.
- Lighthouse (production preview, fresh profile): PWA category passes — installable, splash/maskable icon, theme-color, offline fallback (airplane-mode reload of `/login` shows `/offline`), `viewport-fit`, apple-touch-icon.
- Manual matrix: Chrome/Edge desktop install + launch standalone; Android Add-to-Home-Screen; iOS Safari Add-to-Home-Screen (standalone meta respected); offline reload → fallback; back online → Retry recovers; update toast appears on redeploy.
- Regression: password login, Google SSO (`/auth/sync` bridge), admin reset-password modal, time-log clock in/out timestamps (Manila), payroll computation, dark-input visibility — all unchanged.

## 8. Non-goals (Phase 2 candidates)

Background sync / queued offline clock in/out, IndexedDB outbox, push notifications (VAPID), periodic sync, share-target, protocol handlers, screenshots marketing set, full Workbox analytics. Each needs its own spec; nothing in v1 blocks them (SW file and registration components are the extension points).

## 9. Risks

- Cloudflare Workers static-asset handling of `/sw.js` scope/headers — mitigated by root placement + output verification + minimal-shell fallback.
- Over-caching authenticated HTML (cross-user leak) — mitigated by NetworkFirst-navigations-only + fallback-page pattern; no HTML CacheFirst anywhere.
- Serwist + `next-on-pages` version friction — mitigated by pinning `@serwist/next` to a Next-14-compatible range and verifying in build step before further work.
