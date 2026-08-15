# CRAVECART v2 — Project Guide

Multi-vendor delivery platform (rebuild of dapigo v1) in **React + Express + MongoDB**. The full feature spec lives at `/home/aakash/Projects/dapigo/_analysis/FEATURES_AND_FUNCTIONALITY.md`; the original v1 (eRestro CodeIgniter + Flutter) is at `/home/aakash/Projects/dapigo/` — check its `api-doc.txt` / `partner-api-doc.txt` / `rider-api-doc.txt` for exact v1 behavior when porting features.

## Theme (official CraveCart, from v1 Flutter app)

Primary teal `#00b3a6` (hover `#009288`), success `#33bc88`, ink/sidebar `#292929`, bg `#f7f7f7`, error `#ff4d4d`, warning `#fab44d`. Font **Quicksand** (loaded from Google Fonts in each `index.html`). Logo: `<app>/public/logo.png` (from v1 `Archive/assets/images/png/DapiGoLogo.png`). Brand is written "CraveCart".

## Layout & ports

| Folder      | App                              | Port |
|-------------|----------------------------------|------|
| `backend/`  | Express 4 + Mongoose 8 API (ESM) | 5000 |
| `frontend/` | Customer storefront (**Next.js 16, App Router + Tailwind/Shadcn**) | 4000 |
| `admin/`    | Admin console                    | 5174 |
| `partner/`  | Seller console                   | 5175 |
| `rider/`    | Delivery app                     | 5176 |
| `mobile/`   | Customer mobile app (Expo SDK 57 / React Native) | Metro :8081 |
| `partner-mobile/` | Partner mobile app (Expo SDK 57)           | Metro :8081 |
| `rider-mobile/`   | Rider mobile app (Expo SDK 57, expo-location GPS push) | Metro :8081 |

## Commands (from repo root)

- `npm run dev` — start backend + all 4 frontends (start-all.sh)
- `npm run seed` — reset demo data
- `npm --prefix <app> run dev|build` — individual app

## Critical gotchas

- **Database must be `cravecart_v2`** (`backend/.env`). The old `dapigo` DB has stale unique indexes from v1 that break seeding.
- Demo accounts: `admin|partner|partner2|rider|customer@cravecart.com`, password `<role>123` (e.g. `admin123`).
- Panel logins are role-guarded (`panel` field on `/api/auth/login`).

## Conventions

- **Backend:** routes double as controllers (`backend/src/routes/*.js`), wrapped in `asyncH`; auth via `protect`/`authorize`. Models grouped by domain in `backend/src/models/{User,Catalog,Order,Finance,Misc}.js`. All wallet mutations go through `walletAdjust()` (`utils/helpers.js`); in-app notifications via `notify()`. Order status changes must respect `STATUS_TRANSITIONS` in `models/Order.js`; settlement happens in `settleOrder()` (`routes/orders.js`). Cart pricing is server-authoritative via `priceCart()` (`routes/cart.js`).
- **Customer storefront (`frontend/`):** Next.js 16 App Router — pages in `src/app/**/page.js`, `src/lib/api.js` (fetch wrapper + `money()`/`dt()` + `BASE`/`API_BASE`/`SOCKET_PATH`), `src/lib/i18n.jsx`, contexts in `src/context/`, Tailwind + Shadcn in `src/components/ui/`. Read `frontend/AGENTS.md` **and the bundled docs in `node_modules/next/dist/docs/`** before writing code — this is Next 16, not the Next in your training data. Live updates via socket.io. Deployed under the `/cravecart` path prefix: `basePath` is set from the `NEXT_PUBLIC_BASE_PATH` build arg (inlined at build time), and every hand-built URL (fetch, socket.io) must go through `API_BASE`/`SOCKET_PATH` or it escapes the prefix. Anything touching `window` at import time (Leaflet) must be loaded via `next/dynamic` with `ssr: false`; `useSearchParams` needs a `<Suspense>` boundary or the build fails.
- **Consoles (`admin/`, `partner/`, `rider/`):** identical Vite skeleton per app — `src/api.js`, `src/ctx.jsx` (auth context), `src/components.jsx`, `src/styles.css`, pages in `src/pages/`, routes + nav in `src/App.jsx`. Plain CSS, no UI/state libraries. Vite proxies `/api` and `/uploads` to :5000. Live updates by 10s polling.
- New backend feature = model (grouped file) + route module registered in `server.js`. New console page = `pages/X.jsx` + entry in that app's `NAV` array.
- **Mobile (`mobile/`):** Expo customer app, plain JS mirroring the frontend skeleton — `src/api.js` (token in AsyncStorage; API origin auto-derived from Expo hostUri → `http://<metro-host>:5000`, override with `EXPO_PUBLIC_API_URL`), `src/ctx.jsx` (Auth+Cart contexts), `src/components.jsx` (RN primitives), `src/screens/*`, nav in `App.js` (React Navigation: bottom tabs + stack). Run `npm --prefix mobile run start`, scan QR with Expo Go on the phone (same Wi-Fi as the backend). Payments in-app are COD/wallet only (Stripe/Razorpay SDKs are web-only). Live tracking = Leaflet in a `react-native-webview` (`src/TrackingMap.jsx`) + the same socket.io events as web. New screen = `src/screens/X.jsx` + `Stack.Screen` entry in `App.js`. **`partner-mobile/` and `rider-mobile/`** clone this skeleton (login-gated at the root, tabs only, no cart); they poll every 10s like the web consoles. The rider app pushes GPS via `expo-location` `watchPositionAsync` (throttled ~8s) while a delivery is active, mirroring the console's `navigator.geolocation` flow.
- **Self-pickup orders** (`order.selfPickup`): no rider/delivery charge/tip; partner completes via `ready → delivered` (special-cased in the status route); excluded from rider available list.
- **v1-parity features present:** cities + `/catalog/is-deliverable`, featured sections, `/catalog/promos` (public offers), `/orders/:id/reorder`, forgot/reset password (demo OTP returned in response — swap for SMS/email later).
- **Live tracking (Leaflet + OSM, no API key):** `GET /api/orders/:id/tracking` (party-scoped) returns store/destination/rider coords; rider app pushes GPS via `PUT /api/rider/location` (browser `watchPosition`, throttled ~8s) and has a "Simulate ride" demo button that glides store→customer. Shared map component `frontend/src/TrackingMap.jsx` (copy in `rider/src/`) — emoji div-icon markers, dashed teal polyline, fits bounds once then only moves the rider marker; exports `haversineKm`/`etaMinutes` (~20 km/h). Customer order page polls tracking every 6s while status ∈ assigned/picked_up/out_for_delivery (not self-pickup).
- **Payments (Stripe + Razorpay):** `routes/payments.js` + `Payment` model. Intent-then-confirm with params frozen server-side; Stripe = hosted Checkout (frontend `/payment/stripe-return`), Razorpay = in-page modal + HMAC verify. Shared `placeOrderFromCart()`/`quoteCart()`/`validatePromo()` live in `services/checkout.js` (POST /orders only accepts cod/wallet). Keys via Admin → Settings → Payments (Setting keys `stripe*`/`razorpay*`, `.env` fallback); unconfigured gateways are hidden from checkout. Confirm is idempotent; captured-but-unfulfillable payments auto-refund to wallet. Both gateways also handle wallet top-up (`purpose: 'topup'`). Stripe webhook needs raw body — mounted with `express.raw` before `express.json` in server.js.

## Parity status (v1 → v2)

The authoritative gap list is **`docs/PARITY_AUDIT_2026-07-12.md`** — it supersedes the
self-graded phase table in `docs/MIGRATION_PARITY_PLAN.md`, which marks phases done while
their own checklists still have open rows.

Those gaps are **closed as of 2026-07-12** (OTP verification, Midtrans + PhonePe + the missing
webhooks, geocoding, invoices, bordering cities, system-users CRUD, referral percentage/cap,
ticket types, exchange rate, logout/delete-order/rating-deletes). Read the audit's *Resolution*
section before adding parity work — it also lists what was deliberately left undone.

**Known, deliberate:** Stripe + Razorpay webhooks skip signature verification when no secret is
configured (a forged webhook could fulfill an unpaid order). The newer webhooks refuse instead.
Not changed because Razorpay is live in the deployed stack — fix once the secret is set.

## Motion & UI (storefront)

Three libraries, each with a job — plus a rule that outranks all of them: **this is a shop, not a
showreel.** Motion may make the page feel faster; it may never make it slower to order food.

- **Lenis** (`components/SmoothScroll.jsx`, wraps the app in `layout.js`) — eased wheel scrolling.
  `syncTouch: false` on purpose: momentum-jacking a phone is worse than native scroll. Resets to top
  on route change, since Lenis owns the scroller and Next would otherwise keep the old position.
- **anime.js v4** (`components/Reveal.jsx`) — one staggered scroll-reveal per grid (one
  IntersectionObserver per grid, not one motion component per card). Children start **visible in the
  markup** and are hidden by JS only once we know we can animate them, so a JS failure can never
  strand content at `opacity: 0`. Fires once, then disconnects.
- **three.js** (`components/HeroCanvas.jsx`) — ambient shader backdrop for the hero. One full-bleed
  plane, one draw call, no react-three-fiber. Pauses when off-screen or the tab is hidden; disposes
  its WebGL context on unmount (they're a limited resource — leaking one per navigation kills the tab).

**Two gates decide how much motion a visitor gets** (`lib/motion.js`): `prefers-reduced-motion`
disables all of it, and `useCanRenderWebGL()` additionally requires ≥4 cores, ≥4 GB RAM, no
Save-Data, and an obtainable GL context — otherwise the hero falls back to a static brand gradient.
**three.js is `next/dynamic` + `ssr: false`**, so devices that fail the gate never download the
~516 KB chunk. Verified: it is not in the server bundle and not preloaded in the homepage HTML.

If you add motion, keep both gates. A hero that janks on a mid-range Android costs orders.

## Tests

`npm --prefix backend test` (vitest + supertest). **79 tests, all green** — they cover the flows a
migration silently breaks: the OTP gate, server-authoritative cart pricing, the order status machine
and party scoping, webhook signature verification + idempotent fulfilment, referral payouts,
geocoding, invoices, and the admin lockout guards.

They need a mongod. Fastest path is to point at a running one — `MONGO_TEST_URI=mongodb://127.0.0.1:27017
npm --prefix backend test`; with no `MONGO_TEST_URI` the suite starts its own via
`mongodb-memory-server` (which downloads a binary on first run). Each file gets an isolated database
and collections are wiped between tests, so they can run in any order.

`src/app.js` builds the Express app with no DB, no port and no socket server so supertest can mount
it; `src/server.js` wires those in around it. Rate limiting is disabled under `NODE_ENV=test`.

**Land new parity work with a test.** `../dapigo/api-doc.txt` documents 62 v1 request/response shapes
— characterize against those rather than against v2's current behaviour.
