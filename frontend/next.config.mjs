import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */

// Stray lockfiles above this directory make Next infer the workspace root as $HOME,
// which nests the standalone output under .next/standalone/Projects/... and breaks
// the Dockerfile's COPY paths. Pin the root to this app.
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));

// Path-based deployment (see deploy/nginx.conf): the storefront is published at
// https://<ts-node>.ts.net/cravecart. basePath makes Next emit /cravecart-prefixed page
// and asset URLs; nginx hands Next the prefix back on the way in. It is inlined at
// build time, hence the build ARG in the Dockerfile rather than a runtime env var.
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

// Dev only: stands in for the /api + /uploads proxy the Vite storefront declared in
// vite.config.js. In production nginx terminates both ahead of Next.
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000';

const nextConfig = {
  // Self-contained server bundle for the Docker image.
  output: 'standalone',
  outputFileTracingRoot: APP_DIR,
  turbopack: { root: APP_DIR },
  ...(BASE_PATH ? { basePath: BASE_PATH } : {}),
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
    ]
  },
}

export default nextConfig
