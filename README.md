# CRAVECART v2 — Multi-vendor Delivery Platform

Full-stack rebuild in **React + Node.js (Express) + MongoDB**, with every surface in its own folder:

| Folder      | What it is                        | URL (dev)             |
|-------------|-----------------------------------|-----------------------|
| `backend/`  | REST API (Express 4 + Mongoose 8) | http://localhost:5000 |
| `frontend/` | Customer storefront (React 18 + Vite) | http://localhost:5173 |
| `admin/`    | Admin console                     | http://localhost:5174 |
| `partner/`  | Partner (seller) console          | http://localhost:5175 |
| `rider/`    | Rider (delivery) app              | http://localhost:5176 |
| `mobile/`   | Customer mobile app (Expo / React Native) | Expo Go on your phone |

## Quick start

Requires **Node 18+** and a local **MongoDB** running on `127.0.0.1:27017`.

```bash
npm run install:all   # install deps for all 5 apps
npm run seed          # create demo data (database: cravecart_v2)
npm run dev           # start backend + all 4 frontends
```

### Mobile app (physical phone, no emulator needed)

```bash
npm --prefix mobile install
npm run dev:mobile        # starts Metro; scan the QR with the Expo Go app
```

Phone and laptop must be on the same Wi-Fi; the app auto-targets the backend on the Metro host's port 5000 (override with `EXPO_PUBLIC_API_URL`). In-app payments are COD + wallet (card/UPI via the website). Everything else matches the web storefront: catalog, cart, checkout with promos/tips/self-pickup, live order tracking on a map, wallet, favorites, tickets, notifications.

## Demo accounts (created by seed)

| Panel     | Email                | Password    |
|-----------|----------------------|-------------|
| Admin     | admin@cravecart.com     | admin123    |
| Partner   | partner@cravecart.com   | partner123  |
| Partner 2 | partner2@cravecart.com  | partner123  |
| Rider     | rider@cravecart.com     | rider123    |
| Customer  | customer@cravecart.com  | customer123 |

## The full order flow (try it!)

1. **Customer** (5173): browse → add to cart → checkout with promo `CRAVECART10`, pay COD or wallet.
2. **Partner** (5175): Orders → Accept → Start preparing → Mark ready.
3. **Rider** (5176): Deliveries → Available → Accept → Picked up → Start delivery → Mark delivered.
   - Settlement runs automatically: partner earns items+tax minus commission, rider earns delivery fee + tip.
4. **Customer**: order page → rate the order (updates product/partner/rider ratings).
5. **Admin** (5174): dashboard KPIs, orders, KYC approvals, withdrawals, promos, sliders, tickets, settings, audit log.

## Feature highlights

- **Auth** — JWT, roles (customer/partner/rider/admin), per-panel login guard, profile, change password, addresses, favorites, referral codes.
- **Catalog** — categories, products with variants/add-ons/tags/tax %, sale prices, stock tracking, full-text search, filters & sorting.
- **Cart & checkout** — server-priced cart, multi-store carts (order auto-splits per store), promo validation (platform + store-scoped, min order, max discount, per-user limits), delivery charge with free-delivery threshold, rider tip, order notes.
- **Orders** — full state machine `pending → confirmed → preparing → ready → assigned → picked_up → out_for_delivery → delivered → completed` with role-guarded transitions, cancellation with restock + instant wallet refund, status timeline.
- **Payments/wallet** — COD + wallet, top-up (demo gateway), transactions ledger, withdrawal requests with admin approve/reject, COD-held tracking for riders.
- **Settlement** — per-order commission (% per partner, set by admin), partner & rider earnings credited on delivery.
- **Reviews** — verified-purchase order/product/rider ratings, aggregates, admin moderation.
- **Support** — ticket threads (typed, prioritized), admin reply & status flow; in-app notifications everywhere (order events, KYC, wallet, broadcast campaigns).
- **Admin** — KPI dashboard with charts, user/KYC management, commission control, catalog & marketing (promos, sliders, offers), finance, CMS pages, FAQs, settings, audit log.

## API

Base URL `http://localhost:5000/api`. Main route groups:
`/auth`, `/catalog`, `/cart`, `/orders`, `/wallet`, `/support`, `/partner`, `/rider`, `/admin`, `/upload`, `/health`.

Frontends proxy `/api` and `/uploads` to the backend in dev (see each `vite.config.js`).

## Configuration

`backend/.env`:

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/cravecart_v2
JWT_SECRET=change_me
JWT_EXPIRES=7d
```
