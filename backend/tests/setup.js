import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

// The app reads config from the environment at request time (JWT signing, currency…).
// Tests must not depend on a developer's .env being present or on its values, so pin
// the ones the suite relies on.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret';
process.env.JWT_EXPIRES ||= '7d';
process.env.CURRENCY_CODE ||= 'INR';

// Tests need a throwaway database. Two ways to get one, in order of preference:
//
//   1. MONGO_TEST_URI — point at any reachable mongod (a local one, or a CI service
//      container). This is the fast path and needs no downloads.
//   2. mongodb-memory-server — spins up its own mongod. It normally downloads a binary
//      on first run; MONGOMS_SYSTEM_BINARY reuses one already on the box instead.
//
// Either way the database is dropped between test files, so tests never see each
// other's data and can run in any order.
let memoryServer;

beforeAll(async () => {
  let uri = process.env.MONGO_TEST_URI;

  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }

  await mongoose.connect(uri, { dbName: `cravecart_test_${process.pid}` });
}, 120_000);

afterEach(async () => {
  // Wipe collections rather than dropping the DB — dropping also drops the indexes,
  // and several parity behaviours (unique email, unique city name) depend on them.
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  await memoryServer?.stop();
});
