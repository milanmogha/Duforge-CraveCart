import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, auth, login, makeUser, setSetting } from './helpers.js';
import { City } from '../src/models/Misc.js';

// The long tail of v1 endpoints closed during the migration.
// See docs/PARITY_AUDIT_2026-07-12.md for what each one maps back to.

describe('geocoding (v1 search_places / get_location_details_by_lat_long)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubNominatim = (payload) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => payload }))
    );

  it('requires a logged-in user — the geocoder is rate-limited and must not be an open proxy', async () => {
    const res = await api().get('/api/geo/search?q=delhi');
    expect(res.status).toBe(401);
  });

  it('returns a normalised place for a search', async () => {
    stubNominatim([
      {
        osm_type: 'way', osm_id: 123, display_name: 'Connaught Place, New Delhi',
        lat: '28.63', lon: '77.21',
        address: { city: 'New Delhi', suburb: 'CP', postcode: '110001', country: 'India' },
      },
    ]);

    const user = await makeUser({ role: 'customer' });
    const token = await login(user.email, 'pass1234', 'customer');

    const res = await api().get('/api/geo/search?q=connaught').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.places[0]).toMatchObject({
      label: 'Connaught Place, New Delhi',
      lat: 28.63,
      lng: 77.21,
      city: 'New Delhi',
      pincode: '110001',
    });
  });

  it('does not call the geocoder for a query too short to be meaningful', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const user = await makeUser({ role: 'customer' });
    const token = await login(user.email, 'pass1234', 'customer');

    const res = await api().get('/api/geo/search?q=de').set(auth(token));
    expect(res.body.places).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reverse-geocodes a coordinate into an address', async () => {
    stubNominatim({
      osm_type: 'node', osm_id: 9, display_name: 'Outer Circle, New Delhi',
      lat: '28.63', lon: '77.21',
      address: { city: 'New Delhi', road: 'Outer Circle', postcode: '110001' },
    });

    const user = await makeUser({ role: 'customer' });
    const token = await login(user.email, 'pass1234', 'customer');

    const res = await api().get('/api/geo/reverse?lat=28.63&lng=77.21').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.place).toMatchObject({ city: 'New Delhi', pincode: '110001' });
  });

  it('rejects a reverse lookup without coordinates', async () => {
    const user = await makeUser({ role: 'customer' });
    const token = await login(user.email, 'pass1234', 'customer');

    const res = await api().get('/api/geo/reverse?lat=abc').set(auth(token));
    expect(res.status).toBe(400);
  });
});

describe('addresses carry coordinates (why geocoding exists)', () => {
  it('persists lat/lng so delivery radius and tracking have something to work with', async () => {
    const user = await makeUser({ role: 'customer' });
    const token = await login(user.email, 'pass1234', 'customer');

    const res = await api()
      .post('/api/auth/addresses')
      .set(auth(token))
      .send({
        label: 'Home', line1: 'A-1', area: 'CP', city: 'New Delhi',
        pincode: '110001', lat: 28.6314, lng: 77.2193,
      });

    const saved = res.body.addresses.at(-1);
    expect(saved.lat).toBe(28.6314);
    expect(saved.lng).toBe(77.2193);
  });
});

describe('deliverability (v1 is_city_deliverable + bordering cities)', () => {
  it('treats everywhere as deliverable when no cities are configured', async () => {
    const res = await api().get('/api/catalog/is-deliverable?city=Anywhere');
    expect(res.body.deliverable).toBe(true);
  });

  it('rejects a city that is not on the list', async () => {
    await City.create({ name: 'Delhi', active: true });

    const res = await api().get('/api/catalog/is-deliverable?city=Atlantis');
    expect(res.body.deliverable).toBe(false);
  });

  it('checks the area when the city has a serviceable-area list', async () => {
    await City.create({ name: 'Delhi', active: true, areas: ['Saket'] });

    const ok = await api().get('/api/catalog/is-deliverable?city=Delhi&area=Saket');
    expect(ok.body.deliverable).toBe(true);

    const no = await api().get('/api/catalog/is-deliverable?city=Delhi&area=Narnia');
    expect(no.body.deliverable).toBe(false);
  });

  it('finds the cities that border a given one (v1 get_cities($city_id))', async () => {
    const delhi = await City.create({ name: 'Delhi', active: true });
    await City.create({ name: 'Noida', active: true, borderingCities: [delhi._id] });
    await City.create({ name: 'Mumbai', active: true });

    const res = await api().get(`/api/catalog/cities?borders=${delhi._id}`);
    expect(res.body.cities.map((c) => c.name)).toEqual(['Noida']);
  });
});

describe('ticket types (v1 get_ticket_types)', () => {
  it('lists the types a ticket may be filed under', async () => {
    const user = await makeUser({ role: 'customer' });
    const token = await login(user.email, 'pass1234', 'customer');

    const res = await api().get('/api/support/ticket-types').set(auth(token));
    expect(res.body.types).toEqual(['order', 'payment', 'refund', 'account', 'other']);
  });
});

describe('exchange rates (v1 exchange_rate)', () => {
  it('says it is unconfigured rather than shipping a hardcoded third-party key', async () => {
    const res = await api().get('/api/catalog/exchange-rates');
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/not configured/i);
  });
});

describe('system users (v1 System_users.php)', () => {
  let adminToken, admin;

  beforeEach(async () => {
    admin = await makeUser({ role: 'admin' });
    adminToken = await login(admin.email, 'pass1234', 'admin');
  });

  it('creates, lists, updates and deletes an admin', async () => {
    const created = await api()
      .post('/api/admin/system-users')
      .set(auth(adminToken))
      .send({ name: 'Ops', email: 'ops@test.dapigo', password: 'ops12345' });
    expect(created.status).toBe(201);

    const list = await api().get('/api/admin/system-users').set(auth(adminToken));
    expect(list.body.users).toHaveLength(2);

    const updated = await api()
      .put(`/api/admin/system-users/${created.body.user._id}`)
      .set(auth(adminToken))
      .send({ name: 'Ops Lead' });
    expect(updated.body.user.name).toBe('Ops Lead');

    const removed = await api()
      .delete(`/api/admin/system-users/${created.body.user._id}`)
      .set(auth(adminToken));
    expect(removed.status).toBe(200);
  });

  it('will not let an admin delete their own account', async () => {
    const res = await api().delete(`/api/admin/system-users/${admin._id}`).set(auth(adminToken));
    expect(res.status).toBe(400);
  });

  it('will not let the last active admin be suspended — that would lock everyone out', async () => {
    const res = await api()
      .put(`/api/admin/system-users/${admin._id}`)
      .set(auth(adminToken))
      .send({ status: 'suspended' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last active admin/i);
  });

  it('refuses a non-admin', async () => {
    const customer = await makeUser({ role: 'customer' });
    const token = await login(customer.email, 'pass1234', 'customer');

    const res = await api().get('/api/admin/system-users').set(auth(token));
    expect(res.status).toBe(403);
  });
});
