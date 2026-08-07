# DAPIGO v2 — Deployment (Docker)

## Self-hosted laptop deploy (current) — `docker-compose.deploy.yml`

Self-contained stack (own Mongo, own edge nginx), same pattern as makhana/vanam:

```bash
docker compose -f docker-compose.deploy.yml up -d --build
docker compose -f docker-compose.deploy.yml exec dapigo-api node src/seed/seed.js
```

- Edge nginx publishes **127.0.0.1:6002** → routes `/` (customer web), `/admin`, `/partner`,
  `/rider`, `/api`, `/uploads`, `/socket.io` (config in `deploy/nginx.conf`).
- Public access via a **path mount on the existing 443 Tailscale funnel** (funnel ports
  443/8443/10000 are taken by makhana/vanam/school; paths are unlimited):
  ```bash
  tailscale funnel --bg --set-path=/dapigo http://127.0.0.1:6002
  ```
  → `https://aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net/dapigo` (funnel strips the
  `/dapigo` prefix before nginx sees it).
- **Only the API surface is public-safe**: the mobile APK uses `…/dapigo` as its API origin
  (`/api`, `/uploads`, `/socket.io`). The web consoles use absolute root paths, so open them
  locally at `http://127.0.0.1:6002/{,admin,partner,rider}` — not through the funnel.
- The mobile APK is built with the funnel URL baked in:
  ```bash
  cd mobile && npx expo prebuild -p android
  cd android && ANDROID_HOME=$HOME/Android/Sdk \
    EXPO_PUBLIC_API_URL=https://aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net/dapigo \
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
| `dapigo-frontend` | 5173 | `/dapigo`                    |
| `dapigo-admin`    | 5174 | `/dapigo-admin`              |
| `dapigo-partner`  | 5175 | `/dapigo-partner`            |
| `dapigo-rider`    | 5176 | `/dapigo-rider`              |
| `dapigo-api`      | 5000 | — (Express)                  |

```bash
docker network create server   # once, if it doesn't exist
docker compose up -d --build
docker compose exec dapigo-api node src/seed/seed.js   # optional demo data
```

## Reverse-proxy routing (the important part)

The SPAs are built with a base path (`/dapigo`, `/dapigo-admin`, …) so their static
assets are requested under that prefix. **The edge proxy must strip the prefix** before
forwarding, because inside each container the files live at nginx root (`/`), not under
`/dapigo`.

The browser code calls the API at the **domain root** — `/api/...` and `/uploads/...` —
shared by all four apps against the single backend. So the edge proxy needs these routes:

| Public path        | Target                  | Strip prefix? |
|--------------------|-------------------------|---------------|
| `/dapigo`          | `dapigo-frontend:5173`  | yes           |
| `/dapigo-admin`    | `dapigo-admin:5174`     | yes           |
| `/dapigo-partner`  | `dapigo-partner:5175`   | yes           |
| `/dapigo-rider`    | `dapigo-rider:5176`     | yes           |
| `/api`             | `dapigo-api:5000`       | no            |
| `/uploads`         | `dapigo-api:5000`       | no            |

Without the `/api` and `/uploads` rows, the apps load but every request 404s (or returns
the SPA's `index.html`, which surfaces as `Unexpected token '<' in JSON`).

### Example (nginx edge)

```nginx
location /api/     { proxy_pass http://dapigo-api:5000; }
location /uploads/ { proxy_pass http://dapigo-api:5000; }
location /dapigo/         { proxy_pass http://dapigo-frontend:5173/; }  # trailing / strips prefix
location /dapigo-admin/   { proxy_pass http://dapigo-admin:5174/; }
location /dapigo-partner/ { proxy_pass http://dapigo-partner:5175/; }
location /dapigo-rider/   { proxy_pass http://dapigo-rider:5176/; }
```

### Subdomain style (alternative)

Each app container's own nginx now also reverse-proxies `/api/` and `/uploads/` to
`dapigo-api:5000` (via Docker DNS resolver `127.0.0.11`). So you may instead give each app
its own host (e.g. `admin.example.com` → `dapigo-admin:5174`) and route **everything**
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
  dapigo-api:
    volumes:
      - dapigo-uploads:/app/uploads
  # volumes: { dapigo-uploads: {} }
  ```
