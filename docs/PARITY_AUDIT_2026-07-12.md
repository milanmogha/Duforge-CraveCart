# DapiGO v1 → v2 Parity Audit (2026-07-12)

> **STATUS: all findings below have been addressed.** See "Resolution" at the bottom for
> what changed, what was deliberately left alone, and **two findings in this audit that
> were wrong** (referral credit and "areas") — corrected in place, marked ⚠️.

Independent audit of `~/Projects/dapigo` (v1: CodeIgniter 3 + Flutter, eRestro 1.3.1.1) against
`~/Projects/dapigo-v-2` (v2: Express + Mongo + React/Next + Expo). Every claim below was verified
against source, not against `MIGRATION_PARITY_PLAN.md`.

**Method:** v1 surface = 97 public API methods (`application/controllers/app/v1/Api.php`) + ~50 admin,
20 partner, 7 rider web controllers. v2 surface = 202 routes, enumerated by loading the Express
routers and dumping the route table (not grepped — v2 registers routes across multiple lines and via
a CRUD factory, so grep undercounts badly).

**Headline:** the parity plan marks Phases 1–7 ✅ DONE. Backend parity is genuinely close, and the
admin console does cover v1's ~50 controllers via 9 consolidated pages. But **13 v1 features have no
v2 implementation at all**, several of them unmentioned anywhere in the plan, and there is a
**structural fork in the customer storefront that means dev and prod run different apps.**

---

## 🔴 P0 — Structural: the storefront forked, and prod ships the other one

This is the single most important finding and it is a *process* failure, not a feature gap.

There are two customer storefronts:

| | `frontend/` | `frontend-vite/` |
|---|---|---|
| Stack | Next.js 14 + Shadcn | React + Vite |
| Last touched | `0a7df01`, 2026-07-09 | `ab84df7`, 2026-07-11 |
| i18n (Phase 5) | ❌ absent | ✅ present |
| Live tracking `TrackingMap` | ❌ absent | ✅ present |
| Payment return pages | ❌ **absent** | ✅ `StripeReturn`, `GatewayReturn` |
| `npm run dev` / `start-all.sh` runs it | ✅ **yes** (:4000) | ❌ no |
| `docker-compose.deploy.yml` builds it | ❌ no | ✅ **yes** |

What happened: the Next.js migration landed on 07-09, then **all Phase 1–7 parity work was written
against the old Vite storefront** on 07-11. So the newest, prettiest storefront is also the stalest.

Two consequences, both live bugs:

1. **You develop against one app and deploy another.** `start-all.sh` boots the Next.js app; Docker
   builds the Vite app. Any storefront behavior you verify locally is not what ships.
2. **The Next.js app has no `/payment/stripe-return` or `/payment/gateway-return` route.** If it were
   deployed, every Stripe / PayPal / Paytm / Flutterwave checkout would dead-end on redirect back —
   money captured, order never fulfilled. It is only *not* a production incident because Docker
   happens to build the other app.

**Decide one storefront and delete the other.** Keeping both is what caused this. My recommendation:
keep `frontend-vite/` (it has the parity work), port the Shadcn/Next UI later as a *presentation*
change, and remove `frontend/` — or, if Next.js is the strategic choice, port i18n + TrackingMap +
the two payment-return routes into it *before* switching the deploy over.

---

## 🔴 P1 — v1 features with no v2 implementation

Verified absent from `backend/src/{models,routes,services}`.

### Payments
1. **Midtrans gateway** — v1: `create_midtrans_transaction`, `midtrans_payment_process`,
   `midtrans_wallet_transaction`, `get_midtrans_transaction_status`, `midtrans_webhook`.
   v2: nothing. **Not mentioned anywhere in the parity plan** — this gap was never even tracked.
2. **PhonePe gateway** — v1: `phonepe_app`, `phonepe_web`, `phonepe_webview`, `phonepe_check_status`,
   `phonepe_webhook`. v2: nothing. Also **untracked by the plan.**
3. **Webhooks** — v1 had 6 (stripe, razorpay, flutterwave, midtrans, phonepe, PayPal IPN).
   v2 has 2 (stripe, razorpay). PayPal IPN is a noted deviation; the **Flutterwave webhook is
   silently missing**, so Flutterwave has no server-side reconciliation path.

### Auth / onboarding
4. **OTP verification — entirely absent.** v1: `verify_otp`, `resend_otp`, `verify_user`,
   `get_login_identity`. v2 has **zero OTP endpoints**. Phase 3 wired an SMS *provider*, but the
   signup/login verification gate that consumes it was never built: accounts are created immediately,
   phone numbers are never proven. This is the largest single behavioral divergence from v1.
5. ⚠️ **Referral rewards — THIS FINDING WAS WRONG.** The credit flow *does* exist:
   `grantReferralReward()` in `routes/orders.js` fires from `settleOrder()` and credits the
   referrer's wallet. My initial grep only covered `auth.js`/`User.js` and missed it. The real
   gap was narrower: v2 paid a **flat** amount on the buyer's **first** order only, while v1
   also supports a *percentage* method (capped by `max_refer_earn_amount`) and pays across the
   buyer's first N orders (`refer_earn_bonus_times`). Now extended to match v1.

### Location
6. **Geocoding / place search — absent.** v1: `get_location_details`,
   `get_location_details_by_lat_long`, `search_location`, `search_places`, admin `Openstreetmap.php`.
   v2 has no Nominatim/geocoding code at all. Addresses carry `lat`/`lng` fields with nothing to
   populate them, which quietly undermines delivery-radius checks and rider tracking accuracy.
   **Untracked by the plan.**

### Commerce & ops
7. **Invoices — absent.** v1 had `Invoice.php` (admin + partner) and `Invoice_model`. v2 has **no
   Invoice model or route**; only the POS thermal receipt exists. Order invoices are a v1 feature,
   not a `[NEW]` one.
8. ⚠️ **Areas / zones — THIS FINDING WAS WRONG too** (and so is the parity plan's Phase 1 row).
   v1's `Area.php` / `Area_model.php` is *not* an "areas" entity at all — despite the name it
   manages the **cities** table (its own page titles say "City Management"), plus a
   `bordering_city_ids` list and a delivery-charge method. There is no `areas` table in v1.
   So v2's `areas: [String]` on City was never the gap. The genuine gap was
   **bordering cities** — v1's `get_cities($city_id)` returns every city that lists yours in
   `bordering_city_ids`, which is how a customer near a boundary gets served by partners in the
   neighbouring city. v2 had no equivalent. Now added as `City.borderingCities`.
9. **System users** — v1 `System_users.php`: full CRUD + a per-module permission matrix. v2 has
   **only `POST /admin/system-users`** — you can create a sub-admin but cannot list, edit, or delete
   one, and all admins are full-access. Effectively write-only.
10. **Ticket types** — v1 `get_ticket_types`. v2: none.
11. **Exchange rate / multi-currency** — v1 `exchange_rate`. v2: none. Note this is a real v1 API
    method, so it does **not** belong in the "out of scope `[NEW]`" bucket where it currently hides.
12. **Minor customer methods** — `delete_order`, `logout` (v1 also cleared the FCM token), and the
    three rating deletions (`delete_product_rating`, `delete_order_rating`, `delete_rider_rating`).
    All absent.

### Mobile
13. **FCM push is not actually deliverable.** Phase 3 implemented server-side FCM HTTP v1, but device
    registration needs a native build (`google-services.json` → EAS) that hasn't been done, and no app
    has an EAS `projectId`. So push notifications cannot reach a single real device today. The mobile
    apps are also un-localized, while v1's Flutter apps were.

---

## 🟡 P2 — Process flags

- **No tests. Anywhere.** Zero `*.test.js` / `*.spec.js` in the repo. Every parity claim in the plan
  rests on "smoke-tested e2e" by hand. For a migration whose entire success criterion is "behaves like
  v1", the absence of a regression net is the root cause of the drift above — nothing would have
  caught the storefront fork. **A parity migration needs characterization tests against v1's
  documented request/response shapes** (`api-doc.txt` gives you 62 of them for free).
- **`CLAUDE.md` is stale and actively misleading.** It calls `frontend/` "Customer storefront
  (React+Vite)" (it is Next.js), and its "Not yet implemented" backlog still lists dine-in/POS, i18n,
  payment gateways, and rate limiting — all of which shipped. An agent or new dev reading it will
  make wrong decisions.
- **The parity plan grades itself.** Phase 1 is ✅ DONE while its own table still shows ❌ rows
  (areas, and system-users landed only half-built). Phases should not be closable while their
  checklist has open rows.
- **Endpoint-count parity is a misleading metric.** The plan tracks "v2 ≈ 116 vs v1 ≈ 275" as if
  convergence were the goal, but v2's 202 routes include CRUD factories that inflate the count while
  Midtrans/PhonePe/OTP/geocoding stay at zero. Track *capabilities*, not routes.

---

---

## Resolution (2026-07-12)

Owner chose: **keep Next.js as the storefront**, port parity into it, then close gaps in risk order.

### Storefront (P0)

The Next.js app **did not build at all** — `orders/[id]/page.js` imported `socket.io-client`, which
was never in its `package.json`, and `store/[id]/page.js` had duplicated import lines. So the app
the dev scripts were launching had been broken since it landed. Fixed, then ported in:

- `components/TrackingMap.jsx` (Leaflet; loaded via `next/dynamic` with `ssr: false`, since Leaflet
  touches `window` at import — verified absent from the server bundle). Pure geo math split into
  `lib/geo.js` so the ETA can be computed without pulling Leaflet server-side.
- `lib/i18n.jsx` — same provider, reworked so initial state never reads `window`/`localStorage`
  during the server render.
- `app/payment/stripe-return` + `app/payment/gateway-return` — **the routes whose absence would have
  dead-ended every redirect-gateway payment.** Both wrap `useSearchParams` in `<Suspense>` (Next 16
  fails the build otherwise).
- Checkout gained the redirect-gateway branch (PayPal/Paytm/Flutterwave — it only handled
  Stripe/Razorpay), and the address form gained geocoding.
- `lib/api.js` now derives `API_BASE`/`SOCKET_PATH` from the base path; the socket connection was
  guessing the origin with `window.location.origin.replace('3000','5000')`, which is wrong in prod.
- `next.config.mjs`: `output: 'standalone'`, `basePath` from `NEXT_PUBLIC_BASE_PATH`, a `/uploads`
  rewrite (only `/api` was proxied, so images 404'd in dev), and a pinned `outputFileTracingRoot`
  (stray lockfiles in `$HOME` were nesting the standalone build and breaking the Docker COPY paths).

Deploy switched to it: new `frontend/Dockerfile` (Node server, not static nginx — the app has
server-rendered routes), `docker-compose.deploy.yml` builds `./frontend` on :3000, and
`deploy/nginx.conf` re-adds the `/dapigo` prefix that both the funnel and the local rewrite strip,
so Next receives the prefix its `basePath` expects. Verified by running the standalone server exactly
as the container does: prefixed routes 200, assets emitted under `/dapigo`, unprefixed paths 404.

**`frontend-vite/` is still on disk on purpose** — delete it only after the new image deploys clean.
**The running stack was not rebuilt or restarted.**

### Gaps closed (v2: 202 → 226 routes)

| Gap | What shipped |
|---|---|
| OTP verification (#4) | `Otp` model + `verify-user` / `verify-otp` / `resend-otp` / `login-identity` / `config`, gating registration. Mode is an admin setting (`none`/`sms`/`firebase`, v1's `authentication_settings`), default `none` so demo logins keep working. Verified: gate rejects unverified signup, wrong code rejected, 60s expiry honoured, 5-attempt lockout, single-use (replay blocked). Admin → Settings → **Authentication**; signup UI does the two-step flow. |
| Midtrans + PhonePe (#1,2) | Full intent→confirm→fulfill, reusing the existing idempotent `claimPayment` race guard. Hidden from checkout until enabled; clean 503 when enabled-but-unconfigured. |
| Webhooks (#3) | Flutterwave, Midtrans and PhonePe webhooks added. **Verified: forged signatures rejected (400), valid ones accepted.** |
| Geocoding (#6) | `routes/geo.js` — search / reverse / place lookup via Nominatim (keyless; Google used instead if a key is set, as in v1). Throttled to Nominatim's 1 req/s and cached. Wired into the address form, so **saved addresses now actually carry lat/lng** — verified end-to-end. |
| Invoices (#7) | `GET /orders/:id/invoice` renders a printable A4 document server-side (v1 `get_invoice_html`), party-scoped, all user input escaped. One implementation for storefront + partner + admin. |
| Bordering cities (#8) | `City.borderingCities` + `GET /catalog/cities?borders=<id>`. |
| System users (#9) | List / update / delete added to the create-only endpoint, with guards against deleting yourself or suspending the last active admin. |
| Referral (#5) | Extended to v1's percentage method + cap + `bonusTimes`. |
| Ticket types (#10) | `GET /support/ticket-types`. |
| Exchange rate (#11) | `GET /catalog/exchange-rates`. **The v1 key is not reused** — v1 hardcoded a live exchangeratesapi.io access key in `Api.php`; it reads from Settings instead. That committed key should be treated as compromised and rotated. |
| Minor deletes (#12) | `POST /auth/logout` (retires the FCM token — the part that actually matters for a stateless JWT), `DELETE /orders/:id` (hides finished orders from customer history without destroying the ledger record), `DELETE /orders/:id/rate` (unwinds the cached rating averages, or they drift permanently upward). |

### Closing the rest (same day)

**Stripe + Razorpay webhooks hardened.** Both previously *skipped signature verification entirely
when no secret was configured*. Checking the deployed database found **Razorpay enabled in production
with an empty `razorpayWebhookSecret`** — so `/api/payments/webhook/razorpay` was accepting any
unsigned payload, and a forged `payment.captured` naming a known order id would have fulfilled an
unpaid order. Both webhooks now refuse (503) until their secret is set, like the newer ones.
Safe to do because a blank secret means the webhook was never registered with the gateway anyway, and
real fulfilment runs through the HMAC-verified `/razorpay/verify` confirm path. **Set the secret in
Admin → Settings → Payments to re-enable the reconciliation path.**

**Test suite: 79 tests, all green** (`npm --prefix backend test`). Deliberately aimed at what a
migration breaks quietly, not at coverage percentage:

- the OTP gate — refuses unverified signup, wrong code, expired code, brute-force lockout, single-use
  (a consumed code can't mint a second account), signup/reset codes not interchangeable;
- **pricing is server-authoritative** — a client-supplied `price` is ignored;
- the order status machine — illegal jumps, wrong-role moves, and non-parties are all refused;
- **webhook signatures verified for all five gateways** (forged rejected, valid accepted) and
  **fulfilment is idempotent** — a replayed webhook tops the wallet up ₹500, not ₹1000;
- referral payouts (flat, percentage, cap, minimum, first-N-orders), invoices (party-scoped, output
  escaped), geocoding, ticket types, deliverability + bordering cities, and the admin lockout guards.

To make the API testable, `src/app.js` now builds the Express app with no DB/port/socket
(`server.js` wires those around it), and socket emits go through a guarded `emit()` — previously an
uninitialised socket would have **500'd every order status change**.

**Mobile OTP.** All three Expo apps now run the same `verify-user → verify-otp → register` flow via a
shared `useSignupOtp` hook; with the gate off they behave exactly as before. Without this they would
have broken the moment the OTP setting was switched on.

### Full coverage sweep — every v1 method and controller accounted for

Asked "is *every* feature cloned?", so I stopped trusting the running list and mapped the whole v1
surface mechanically instead. That sweep found **five more gaps**, all now closed and live:

| v1 method | Was | Now |
|---|---|---|
| `get_rider_rating` | Customers could *rate* a rider, but the rider's rating was **never returned anywhere** — the order populate selected `vehicleType` and coordinates, never `ratingAvg`. | Exposed on the order. |
| `get_order_rating` / `get_product_rating` | No way to read back a rating you'd left. | `GET /orders/:id/rate` (store + rider + products in one call). |
| `edit_ticket` | Could reply and change status, but not fix the ticket itself. | `PUT /support/tickets/:id`. Frozen once closed, so a resolved thread can't be rewritten under the agent who answered it. Note v2 has **no `description` column** — the body is the first entry in the `messages[]` thread, so editing rewrites that. |
| `get_delivery_charges` | Computed inside the cart, but not quotable before one existed. | `GET /catalog/delivery-charges` — shares the `priceCart()` rule, and a test asserts the two agree so they can't drift. |
| `ipn` (PayPal webhook) | The last missing webhook. | `POST /payments/webhook/paypal`. PayPal issues no shared secret — verification calls **back** to PayPal with the webhook-subscription id, so it needs `paypalWebhookId` (Admin → Settings → Payments) and refuses until set. |

Also fixed while sweeping: the referral **percentage / cap / bonus-times** settings I added earlier had
**no admin UI** — the backend read them but nothing could set them. Now in Settings → General.

**Final tally, both sides enumerated mechanically:**

- **95 / 95 v1 API methods** → 92 map to a live v2 route; 3 (`paypal_transaction_webview`,
  `flutterwave_webview`, `phonepe_webview`) are Flutter WebView shims with no analogue — v2 redirects
  the browser instead. **0 unmapped.**
- **77 / 77 v1 web controllers** → 74 covered; **3 deliberately not ported**: `Purchase_code`
  (eRestro licence check), `Updater` (eRestro auto-updater), `Migrate` (CI3 migration runner). These
  are the eRestro vendor's own infrastructure, not DapiGO features — porting them would mean
  reimplementing someone else's licensing.
- **92 tests, all green.**

### Deployed ✅

`docker compose -f docker-compose.deploy.yml up -d` — the Next.js storefront, the hardened API and the
new admin console are **live** on `127.0.0.1:6002` (the Tailscale funnel origin). Verified after the
swap: storefront root + `/checkout` + both payment-return routes serve 200, assets load under
`/dapigo`, `/api/health` and `/admin/` are up, login and `catalog/home` still work, and a forged
Razorpay webhook is now refused in production. `frontend-vite/` has been deleted
(recoverable: `git checkout ab84df7 -- frontend-vite`).

One thing bit us during the swap and is worth remembering: **nginx must be restarted explicitly**
after `deploy/nginx.conf` changes — it's a read-only bind mount, so `up -d` leaves the old config in
a still-running container. And the old `location = /dapigo { return 301 /dapigo/; }` (needed when the
storefront was static Vite) **deadlocks against Next**, whose `basePath` serves the root as `/dapigo`
and 308s the trailing slash straight back. That rule is now a `rewrite`, and `location = /` proxies
the root without adding a slash.

### Still not done — needs you

- **Set the Razorpay webhook secret** (Admin → Settings → Payments). It is enabled in production with
  no secret, so its webhook currently 503s by design. Checkout is unaffected — fulfilment runs through
  the HMAC-verified confirm path — but the reconciliation path stays off until the secret is set.
- **FCM native builds** — `google-services.json` + `eas init` per app. Needs your Firebase/Expo
  accounts; push cannot reach a real device until this is done. This is the last v1 capability with no
  v2 equivalent in service.
- **Rotate the exchangeratesapi.io key** that v1 hardcoded in `Api.php`. Treat it as compromised.
