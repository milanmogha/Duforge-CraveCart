import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import walletRoutes from './routes/wallet.js';
import supportRoutes from './routes/support.js';
import partnerRoutes from './routes/partner.js';
import dineinRoutes from './routes/dinein.js';
import riderRoutes from './routes/rider.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes, { UPLOAD_DIR } from './routes/upload.js';
import paymentRoutes from './routes/payments.js';
import geoRoutes from './routes/geo.js';

// The Express app, with no database connection, no port binding and no socket server —
// so the test suite can mount it with supertest. `server.js` wires those in around it.
export function createApp() {
  const app = express();

  // Deployed chain is client → Tailscale funnel → edge nginx → api (2 proxy hops);
  // without this every public client shares one rate-limit bucket.
  app.set('trust proxy', 2);

  app.use(cors());

  // Rate limiting would make the test suite flaky (hundreds of requests from one IP).
  if (process.env.NODE_ENV !== 'test') {
    app.use(
      '/api',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        message: { message: 'Too many requests, please try again later.' },
      })
    );
  }

  // Stripe webhook needs the raw body for signature verification — mount before json parser
  app.use('/api/payments/webhook/stripe', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '2mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.use('/uploads', express.static(UPLOAD_DIR));

  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', service: 'dapigo-api', time: new Date().toISOString() })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/partner', partnerRoutes);
  app.use('/api/dinein', dineinRoutes);
  app.use('/api/rider', riderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/geo', geoRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
