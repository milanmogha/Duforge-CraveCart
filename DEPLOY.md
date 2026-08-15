# CRAVECART v2 — Deployment (Docker)

## Self-hosted laptop deploy (current) — `docker-compose.deploy.yml`

Self-contained stack (own Mongo, own edge nginx), same pattern as makhana/vanam:

```bash
docker compose -f docker-compose.deploy.yml up -d --build
docker compose -f docker-compose.deploy.yml exec cravecart-api node src/seed/seed.js
```

- Edge nginx publishes **127.0.0.1:6002** → routes `/` (customer web), `/admin`, `/partner`,
  `/rider`, `/api`, `/uploads`, `/socket.io` (config in `deploy/nginx.conf`).
- Public access via a **path mount on the existing 443 Tailscale funnel** (funnel ports
  443/8443/10000 are taken by makhana/vanam/school; paths are unlimited):
  ```bash
  tailscale funnel --bg --set-path=/cravecart http://127.0.0.1:6002
  ```
  → `https://aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net/cravecart` (funnel strips the
  `/cravecart` prefix before nginx sees it).
- **Only the API surface is public-safe**: the mobile APK uses `…/cravecart` as its API origin
  (`/api`, `/uploads`, `/socket.io`). The web consoles use absolute root paths, so open them
  locally at `http://127.0.0.1:6002/{,admin,partner,rider}` — not through the funnel.
- The mobile APK is built with the funnel URL baked in:
  ```bash
  cd mobile && npx expo prebuild -p android
  cd android && ANDROID_HOME=$HOME/Android/Sdk \
    EXPO_PUBLIC_API_URL=https://aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net/cravecart \
    ./gradlew assembleRelease
  # → android/app/build/outputs/apk/release/app-release.apk
  ```
- Backend `trust proxy` is set to 2 (funnel + edge nginx) so rate limiting sees real client IPs.

## Server-stack deploy (older alternative)

`docker-compose.yml` builds 5 containers on the **external** Docker network `server`
and only `expose`s their ports (nothing is published to the host). A separate
reverse proxy on that network terminates TLS and routes public traffic.

| Container         | Port | Built with `VITE_BASE_PATH` |
|-------------------|------|------------------------------|
| `cravecart-frontend` | 5173 | `/cravecart`                    |
| `cravecart-admin`    | 5174 | `/cravecart-admin`              |
| `cravecart-partner`  | 5175 | `/cravecart-partner`            |
| `cravecart-rider`    | 5176 | `/cravecart-rider`              |
| `cravecart-api`      | 5000 | — (Express)                  |

```bash
docker network create server   # once, if it doesn't exist
docker compose up -d --build
docker compose exec cravecart-api node src/seed/seed.js   # optional demo data
```

## Reverse-proxy routing (the important part)

The SPAs are built with a base path (`/cravecart`, `/cravecart-admin`, …) so their static
assets are requested under that prefix. **The edge proxy must strip the prefix** before
forwarding, because inside each container the files live at nginx root (`/`), not under
`/cravecart`.

The browser code calls the API at the **domain root** — `/api/...` and `/uploads/...` —
shared by all four apps against the single backend. So the edge proxy needs these routes:

| Public path        | Target                  | Strip prefix? |
|--------------------|-------------------------|---------------|
| `/cravecart`          | `cravecart-frontend:5173`  | yes           |
| `/cravecart-admin`    | `cravecart-admin:5174`     | yes           |
| `/cravecart-partner`  | `cravecart-partner:5175`   | yes           |
| `/cravecart-rider`    | `cravecart-rider:5176`     | yes           |
| `/api`             | `cravecart-api:5000`       | no            |
| `/uploads`         | `cravecart-api:5000`       | no            |

Without the `/api` and `/uploads` rows, the apps load but every request 404s (or returns
the SPA's `index.html`, which surfaces as `Unexpected token '<' in JSON`).

### Example (nginx edge)

```nginx
location /api/     { proxy_pass http://cravecart-api:5000; }
location /uploads/ { proxy_pass http://cravecart-api:5000; }
location /cravecart/         { proxy_pass http://cravecart-frontend:5173/; }  # trailing / strips prefix
location /cravecart-admin/   { proxy_pass http://cravecart-admin:5174/; }
location /cravecart-partner/ { proxy_pass http://cravecart-partner:5175/; }
location /cravecart-rider/   { proxy_pass http://cravecart-rider:5176/; }
```

### Subdomain style (alternative)

Each app container's own nginx now also reverse-proxies `/api/` and `/uploads/` to
`cravecart-api:5000` (via Docker DNS resolver `127.0.0.11`). So you may instead give each app
its own host (e.g. `admin.example.com` → `cravecart-admin:5174`) and route **everything**
there; API/upload calls resolve through the app container. In that case build the images
with `VITE_BASE_PATH=/` (root).

## Before going to production

- **`backend/.env.production`**: set a strong unique `JWT_SECRET`, `NODE_ENV=production`,
  and **rotate the MongoDB password** (the committed value must not be reused). Keep this
  file out of the image / VCS.
- **Payment keys**: set Razorpay/Stripe keys in **Admin → Settings → Payments** (DB wins
  over `.env`). Add the gateway webhooks:
  - Razorpay: `https://<host>/api/payments/webhook/razorpay`, event `payment.captured`
  - Stripe: `https://<host>/api/payments/webhook/stripe`, event `checkout.session.completed`
- **Uploads volume**: user/partner-uploaded images are written to the API container's
  `/app/uploads`. Mount a named volume there or images are lost on redeploy:
  ```yaml
  cravecart-api:
    volumes:
      - cravecart-uploads:/app/uploads
  # volumes: { cravecart-uploads: {} }
  ```
