# DapiGO v2 — Migration Parity Plan (v1 → v2)

> **Mission statement (owner, 2026-07-11):** v2 is a **stack migration** — PHP CodeIgniter 3 + Flutter → Node/Express + React + React Native (Expo) — **not a redesign of scope**. Target is feature-for-feature parity with v1 (`~/Projects/dapigo`). The rebuild-spec's `[NEW]` items (`_analysis/FEATURES_AND_FUNCTIONALITY.md`) are OUT of scope unless explicitly promoted.
>
> Source of truth for parity: the v1 code itself — `api-doc.txt` (62 customer methods), `partner-api-doc.txt` (38), `rider-api-doc.txt` (17), and `application/controllers/{admin,partner,rider}/` (~50 admin + ~20 partner web controllers).

## Current parity status (audited 2026-07-11)

**Done in v2** (verified in `backend/src/routes/`): auth/login/roles, addresses, cities/deliverability, sliders, offers, categories, products **with variants+addons wired through cart/checkout**, promo codes, orders + status machine, self-pickup, reorder, product ratings, cart, favorites, notifications (in-app), sections, transactions, tickets/messages, FAQs, delivery charges, wallet + withdrawal requests, Stripe + Razorpay + COD/wallet payments, live tracking (socket.io + Leaflet — exceeds v1 polling), settings, pages, media upload, admin CRUD consoles, customer mobile app (Expo).

**v2 endpoint count ≈ 116 vs v1 ≈ 275.** The gap phases below close the rest.

---

## Phase 1 — Commerce & console parity (no external accounts needed)

**✅ DONE 2026-07-11** (all rows below implemented & smoke-tested e2e on the dev DB). Deviations from v1, accepted for now:
- *System users*: full-access admins only — v1's per-module permission matrix not replicated.
- *Attributes*: used for structured product attributes + catalog filtering (`?attr=Size:Large`); v1's attribute→variant matrix generation not replicated (v2 keeps free-form variants).
- *Media*: deleting a library entry removes the record, not the file on disk.
- *Cron*: plain 5-min `setInterval` in `src/jobs.js` (keys `autoCancelMinutes`, `autoCompleteDays`), not an external cron.
- Also fixed while testing: `middleware/validate.js` crashed the whole API on any validation error (zod v4 renamed `err.errors`→`err.issues`).

| v1 feature | v1 source | v2 status |
|---|---|---|
| Taxes CRUD + product tax application | admin/partner `Taxes.php`, `get_taxes` | ❌ missing |
| Attributes + attribute values (product filtering) | `Attribute(s).php`, `add/edit/get_attributes`, `get_attribute_values` | ❌ missing |
| Tags CRUD + product tags | `Tag.php`, `get/add/delete_tags`, `get_product_tags` | ❌ missing |
| Media library (browse/reuse uploads) | `Media.php`, `get_media`, `upload_media` | ⚠️ upload exists; no library UI/API |
| Areas/zones under cities | admin `Area.php` | ❌ missing (v2 has cities only) |
| Rider ratings (by customer) | `set/get/delete_rider_rating` | ❌ missing |
| Referral codes (`validate_refer_code`, capture at signup) | api-doc #50 | ⚠️ partial — finish validate + credit flow |
| Delete my account | api-doc #60 | ❌ missing |
| Return requests | admin `Return_request.php` | ❌ missing |
| Fund transfers (admin→rider/partner ledger) | `Fund_transfer.php`, rider `get_fund_transfers` | ❌ missing |
| Rider cash collection (COD reconciliation) | `get_rider_cash_collection` | ❌ missing |
| Sales inventory report | `Sales_inventory.php` | ❌ missing |
| Payment statistics (admin) | `Payment_statistics.php` | ❌ missing |
| Custom notifications (admin composes broadcast) | `Custom_notification.php` | ❌ missing (in-app first; push in Phase 3) |
| Cron jobs (auto-cancel stale orders, etc.) | `Cron_job.php` | ❌ missing → node-cron |
| Statistics dashboards (partner/rider) | `get_statistics` | ⚠️ verify parity of numbers |
| Bulk price update | `Bulk_actual_price.php` | ❌ missing |
| System users (admin sub-roles) | `System_users.php` | ❌ missing |

## Phase 2 — Dine-in / POS module (self-contained)

**✅ DONE 2026-07-11** — v1 partner console `Point_of_sale.php` + `Table_booking.php` ported:

- `models/DineIn.js`: Floor, DiningTable, Waiter, TableBooking (all partner-scoped); Order gained `orderType` (delivery|pos|dine_in) + `table`/`waiter` refs.
- `routes/dinein.js` (`/api/dinein`, partner-only): floors/tables/waiters CRUD, bookings list+update (status flow pending→confirmed→seated→completed, table assignment, customer notified), POS billing (`POST /pos/orders`) with server-authoritative pricing incl. live taxes/variants, walk-in customer register-or-reuse by phone (v1 behavior), stock/soldCount decrement.
- Public `POST /api/catalog/partners/:id/book-table` (guest or logged-in) + "Book a table" modal on the storefront store page; partner notified in-app.
- Partner console "Dine-in & POS" page: POS billing screen (product grid + bill panel + discount + table/waiter), Sales history, Tables & floors, Waiters, Bookings tabs; **thermal receipt** print view (80mm, v1 `partner_thermal_invoice.php` equivalent) from POS and sales history.

Deviations: POS cash sales are recorded (`settled`, `partnerEarning=total`) with **no wallet movement or commission** — cash never touches the platform; A4 PDF invoice not ported (thermal receipt only, browsers can print-to-PDF).

## Phase 3 — Real comms channels

**🔌 WIRED 2026-07-11 (pitch mode — dev-mode fallback until credentials added).** `services/comms.js`:
- **SMS**: provider abstraction (Twilio / Fast2SMS; MSG91 skipped — its API is DLT-template-only) via Settings; unconfigured → `[sms:dev]` log + OTP still returned in API responses (existing demo behavior preserved).
- **Email**: nodemailer SMTP via Settings + branded `emailTemplate()`; unconfigured → logged.
- **FCM push**: HTTP v1 implemented with `jsonwebtoken` RS256 (no firebase-admin dep); paste service-account JSON in Settings. `notify()` now mirrors every in-app notification to registered devices; dead tokens auto-pruned. `POST /auth/fcm-token` (v1 update_fcm) + `fcmTokens[]` on User.
- Forgot-password sends via SMS+email when configured; demo code only when neither delivers.
- Admin → Settings → **Communications** tab configures all three.
- Remaining when credentials arrive: verify deliverability; mobile app FCM registration needs a native build (google-services.json → EAS).

## Phase 4 — Payments long tail

**🔌 WIRED 2026-07-11 (pitch mode — adapters untested until merchant credentials exist).**
- **PayPal** (Orders v2 redirect-approval, sandbox default), **Paytm** (initiateTransaction + hosted page via official `paytmchecksum`, staging default), **Flutterwave** (hosted standard checkout) — all behind the existing intent→claim→fulfill abstraction with idempotent confirm, clean 503 when enabled-but-unconfigured, hidden from checkout until enabled.
- Payment/Order enums extended; generic `gatewayOrderId`; shared `/payment/gateway-return` page on the storefront; Admin → Settings → Payments has sections + test-mode toggles for all three.
- v1's PayPal IPN webhook not ported (client confirm + idempotent claim covers it; add webhooks per gateway if reconciliation needed later).

## Phase 5 — Localization

**✅ DONE 2026-07-11.** Reality check on v1: of the 42 language dirs, only **english, hindi, gujarati** had real product packs (`web_labels_lang.php`, 135 keys); "arebic" was a 6-key stub; the rest were CI3 framework auth files only. So true v1 parity = en/hi/gu.

- **Backend**: `Language` model (code/name/nativeName/rtl/active/strings Map) in Misc.js; public `GET /catalog/languages` + `/languages/:code`; admin CRUD via the factory; boot-time seeding from `seed/v1-languages.json` (parsed from the PHP packs + ~17 new storefront-chrome keys translated to hi/gu; ar seeded inactive for the RTL demo).
- **Storefront**: custom ~60-line `I18nProvider` (`src/i18n.jsx`, no i18next dep) — `t(key, fallback)` with English fallback per call, localStorage cache, `?lang=hi` deep link, sets `<html lang dir>`; RTL CSS overrides. Header/footer/home/hero/store-page wired; language picker in the header.
- **Admin**: Settings → Languages — add language (copies English pack), enable/disable, RTL flag, searchable string editor.
- Remaining (note): inner pages (checkout/orders/profile) still have hardcoded strings — wrap with `t()` incrementally using existing v1 keys (checkout/subtotal/grand_total/etc. already in the packs); consoles + mobile app not localized (v1 apps were — port keys to Expo later via the same API).

## Phase 6 — Partner & Rider mobile apps (React Native/Expo)

**✅ DONE 2026-07-11.** v1 had Flutter apps for partner (orders/inventory) and rider (deliveries); ported as two Expo SDK 57 apps cloned from the `mobile/` skeleton (same api.js/ctx.jsx/components.jsx pattern, auth gated at the root since every screen needs login, 10s polling like the web consoles).
- **`partner-mobile/`** (`com.dapigo.partner`): Dashboard (stats + 7-day sales bars + recent orders + KYC banner), Orders (tab filters, accept/reject with reason sheet, preparing→ready flow, self-pickup handover), Products (search + availability toggle + stock at a glance — full editing stays on the web console), Wallet (withdrawals + transactions), Store (open/closed switch saves instantly; profile/delivery-pricing/bank forms). Partner registration (storeName) + forgot-password included.
- **`rider-mobile/`** (`com.dapigo.rider`): Dashboard (online/offline switch, today/week earnings, COD held), Deliveries (available/active/history, accept, picked_up→out_for_delivery→delivered flow, Leaflet TrackingMap in WebView, **real GPS push via expo-location** watchPositionAsync throttled ~8s while a delivery is active — replaces the console's navigator.geolocation — plus the "Simulate ride" demo), Wallet (withdrawals + COD cash-in-hand/deposits + transactions), Profile (vehicle/bank forms). Rider registration (vehicleType) + forgot-password included.
- Remaining (note): FCM push registration needs the Phase 3 native-build step (google-services.json → EAS); apps not localized yet (same as customer app); no EAS projectIds yet — run `eas init` per app before store builds.

## Phase 7 — Platform ops leftovers

**✅ DONE 2026-07-11.** All four items smoke-tested e2e against a local backend + admin build.
- **Database backup** (v1 `Database_bakup.php`): Admin → Settings → Database. Pick collections (or all) → streamed **gzipped JSON archive** `{collection: [docs]}` (deviation from v1's SQL zip — Mongo-native, restore with any import tooling; no mongodump binary needed inside the container). `GET /admin/backup/collections` + `GET /admin/backup?collections=…`, collection names whitelisted server-side, audited.
- **Client API keys** (v1 `Client_api_keys.php`): `ApiKey` model (name + immutable 40-hex secret + active), admin CRUD + the v1-style copyable 30-min JWT preview (`GET /admin/api-keys/:id/token`, 400 when disabled). Admin → Settings → API keys. Deviation: v2 has no separate "client API" surface yet, so keys are management-only until an external-facing API exists.
- **Pages parity**: v1 `Contact_us` / `Partner_privacy_policy` / `Rider_privacy_policy` added — seed now creates `contact`, `partner-privacy`, `rider-privacy` alongside about/privacy/terms; all six public via `GET /catalog/pages/:slug` and editable in Settings → Pages.
- **Web settings parity** (v1 `Web_setting.php`): added `webLogo`, `webFavicon`, `heroImage`, `metaDescription` (branding, exposed via the public home-endpoint whitelist), `maxCartItems` + `minCartAmount` (**enforced** in `enforceCartLimits()` on both quote and place paths, 0 = off), `minAppVersion` (advisory for mobile apps). Not ported: timezone (server-side irrelevance), `rider_bonus_percentage` (v2 pays per-delivery charge + tip instead).

---

**Working rule:** for any behavior question, check v1 source first (`api-doc.txt` request/response shapes, controller code) and match it; only deviate where the stack forces it, and note the deviation here.

**Explicitly out of scope** (spec `[NEW]`, never in v1): social login, 2FA, guest checkout, multi-partner order split, scheduled/recurring orders, BNPL, Stripe Connect, Meilisearch, loyalty program, flash sales, cohort analytics, GDPR tooling, CI/CD scaffolding.
