# CRAVECART Admin (Vite + React) — production, port 5174
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi
COPY . .
ARG VITE_BASE_PATH=/cravecart-admin
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html

RUN echo 'server { \
    listen 5174; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    include /etc/nginx/mime.types; \
    default_type application/octet-stream; \
    resolver 127.0.0.11 ipv6=off valid=10s; \
    location /api/ { set $up http://cravecart-api:5000; proxy_pass $up; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } \
    location /uploads/ { set $up http://cravecart-api:5000; proxy_pass $up; } \
    location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 5174
CMD ["nginx", "-g", "daemon off;"]
