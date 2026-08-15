import 'dotenv/config';
import http from 'http';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './socket.js';

const app = createApp();
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => {
    server.listen(PORT, () => console.log(`CRAVECART API & WebSocket listening on http://localhost:${PORT}`));
    if (process.env.NODE_ENV !== 'test') {
      import('./jobs.js').then(({ startJobs }) => startJobs());
      import('./seed/ensureLanguages.js')
        .then(({ ensureLanguages }) => ensureLanguages())
        .catch((e) => console.error('[i18n] seed failed:', e.message));
    }
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });
