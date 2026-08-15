# CRAVECART customer storefront (Next.js) — production
# Unlike the old Vite storefront this is not a static bundle: the app has
# server-rendered routes, so the image ships a Node server (`output: 'standalone'`).
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi
COPY . .

# basePath is inlined into the client bundle at build time — it cannot be switched later.
ARG NEXT_PUBLIC_BASE_PATH=/cravecart
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The standalone server does not bundle `public` or `.next/static` — copy them in
# or every asset 404s.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
