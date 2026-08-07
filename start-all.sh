#!/bin/bash
# Start backend + all 4 frontends. Ctrl-C stops everything.
cd "$(dirname "$0")"

trap 'kill 0' EXIT INT TERM

npm --prefix backend run dev &
sleep 2
npm --prefix frontend run dev -- -p 4000 &
npm --prefix admin run dev -- --port 4001 &
npm --prefix partner run dev -- --port 4002 &
npm --prefix rider run dev -- --port 4003 &

echo ""
echo "──────────────────────────────────────────────"
echo "  DAPIGO is starting…"
echo "  API      → http://localhost:5000/api/health"
echo "  Customer → http://localhost:4000"
echo "  Admin    → http://localhost:4001"
echo "  Partner  → http://localhost:4002"
echo "  Rider    → http://localhost:4003"
echo "──────────────────────────────────────────────"
wait
