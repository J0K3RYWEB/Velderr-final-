import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuid } from 'uuid';

// ---------- storage ----------
const root = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(root, '..', 'data');
fs.mkdirSync(dir, { recursive: true });

const files = { bookings: 'bookings.json', staff: 'staff.json', quotes: 'quotes.json', payments: 'payments.json' };
for (const f of Object.values(files)) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) fs.writeFileSync(p, '[]');
}
const read = (k) => JSON.parse(fs.readFileSync(path.join(dir, files[k]), 'utf8'));
const write = (k, v) => fs.writeFileSync(path.join(dir, files[k]), JSON.stringify(v, null, 2));
const clean = (x) => String(x ?? '').trim();
const now = () => new Date().toISOString();

// ---------- app ----------
const app = express();
app.use(cors());
app.use(express.json());

// ---------- auth (real sessions, not a deterministic static token) ----------
const ADMIN_USER = process.env.ADMIN_USER || 'admin@velderr.com';
const ADMIN_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH ||
  crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'VelderrMVP!2026').digest('hex');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const sessions = new Map(); // token -> { user, expires }

function issueSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, expires: Date.now() + SESSION_TTL_MS });
  return token;
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
  session.expires = Date.now() + SESSION_TTL_MS; // sliding expiry
  req.user = session.user;
  next();
}

// periodically sweep expired sessions
setInterval(() => {
  const t = Date.now();
  for (const [token, s] of sessions) if (s.expires < t) sessions.delete(token);
}, 10 * 60 * 1000).unref();

// ---------- static reference data ----------
const SERVICES = [
  { name: 'Event Ushering', desc: 'Professional ushers for conferences, weddings, corporate events and concerts.' },
  { name: 'VIP Management', desc: 'Premium guest reception, protocol and discreet assistance.' },
  { name: 'Crowd Control', desc: 'Safe, orderly guest movement and event-flow support.' },
  { name: 'Event Support', desc: 'Registration, directions, guest assistance and on-site coordination.' },
  { name: 'Brand Representation', desc: 'Polished staff who represent your brand with integrity and elegance.' },
];

// The package tiers from the Velderr rate card — previously missing from the API entirely.
const PACKAGES = [
  { id: 'bronze', name: 'Bronze', minGuests: 50, maxGuests: 100, ushers: 5, price: 500000 },
  { id: 'silver', name: 'Silver', minGuests: 101, maxGuests: 250, ushers: 10, price: 1200000 },
  { id: 'gold', name: 'Gold', minGuests: 251, maxGuests: 500, ushers: 15, price: 2000000 },
  { id: 'platinum', name: 'Platinum', minGuests: 501, maxGuests: 750, ushers: 20, price: 3000000 },
  { id: 'diamond', name: 'Diamond', minGuests: 751, maxGuests: 1000, ushers: 25, price: 4500000 },
  { id: 'double-diamond', name: 'Double Diamond', minGuests: 1001, maxGuests: 1500, ushers: 30, price: 5000000 },
  { id: 'triple-diamond', name: 'Triple Diamond', minGuests: 1501, maxGuests: 2000, ushers: 40, price: 6000000 },
];

// ---------- public endpoints ----------
app.get('/api/health', (_, res) => res.json({ ok: true, service: 'Velderr API', version: '1.1.0' }));

app.post('/api/auth/login', (req, res) => {
  const email = clean(req.body?.email);
  const password = clean(req.body?.password);
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  if (email !== ADMIN_USER || passwordHash !== ADMIN_PASSWORD_HASH) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = issueSession(email);
  res.json({ token, user: { email, role: 'admin' } });
});

app.post('/api/auth/logout', auth, (req, res) => {
  const header = req.headers.authorization || '';
  sessions.delete(header.slice(7));
  res.json({ ok: true });
});

app.get('/api/public/services', (_, res) => res.json(SERVICES));
app.get('/api/public/packages', (_, res) => res.json(PACKAGES));

app.get('/api/public/recommend', (req, res) => {
  const guests = Number(req.query.guests || 0);
  if (!guests || guests < 1) return res.status(400).json({ error: 'guests must be a positive number' });
  const match = PACKAGES.find((p) => guests <= p.maxGuests) || PACKAGES[PACKAGES.length - 1];
  res.json(match);
});

app.post('/api/bookings', (req, res) => {
  const b = req.body || {};
  if (!clean(b.name) || !clean(b.phone) || !clean(b.date) || !clean(b.service)) {
    return res.status(400).json({ error: 'Name, phone, date and service are required' });
  }
  const guests = Number(b.guests || 0);
  const suggested = guests ? PACKAGES.find((p) => guests <= p.maxGuests) || PACKAGES[PACKAGES.length - 1] : null;
  const record = {
    id: uuid(),
    reference: 'VEL-' + Date.now().toString().slice(-7),
    name: clean(b.name),
    email: clean(b.email),
    phone: clean(b.phone),
    date: clean(b.date),
    time: clean(b.time),
    location: clean(b.location),
    guests,
    service: clean(b.service),
    package: clean(b.package) || suggested?.name || '',
    budget: Number(b.budget || 0),
    message: clean(b.message),
    status: 'pending',
    assignedStaff: [],
    notes: '',
    createdAt: now(),
    updatedAt: now(),
  };
  const all = read('bookings');
  all.push(record);
  write('bookings', all);
  res.status(201).json(record);
});

app.get('/api/public/bookings/:reference', (req, res) => {
  const x = read('bookings').find((b) => b.reference === req.params.reference);
  if (!x) return res.status(404).json({ error: 'Booking not found' });
  res.json({
    reference: x.reference,
    date: x.date,
    time: x.time,
    location: x.location,
    service: x.service,
    package: x.package,
    status: x.status,
    createdAt: x.createdAt,
  });
});

// Public, read-only lookup so staff can see their own assignments without an admin session.
// Matches by phone number only — no sensitive customer data beyond what's needed on-site.
app.get('/api/public/staff-assignments/:phone', (req, res) => {
  const phone = clean(req.params.phone);
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  const staffMember = read('staff').find((s) => s.phone === phone);
  if (!staffMember) return res.status(404).json({ error: 'No staff record found for that phone number' });
  const assignments = read('bookings')
    .filter((b) => b.assignedStaff?.includes(staffMember.id))
    .filter((b) => b.status === 'confirmed' || b.status === 'pending')
    .map((b) => ({
      reference: b.reference,
      service: b.service,
      package: b.package,
      date: b.date,
      time: b.time,
      location: b.location,
      status: b.status,
    }));
  res.json({ staff: { name: staffMember.name, role: staffMember.role }, assignments });
});

// ---------- admin endpoints ----------
app.get('/api/bookings', auth, (_, res) => res.json(read('bookings').sort((a, b) => b.createdAt.localeCompare(a.createdAt))));

app.patch('/api/bookings/:id', auth, (req, res) => {
  const all = read('bookings');
  const i = all.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Booking not found' });
  for (const k of ['status', 'assignedStaff', 'notes', 'budget', 'quoteId', 'package']) {
    if (k in req.body) all[i][k] = req.body[k];
  }
  all[i].updatedAt = now();
  write('bookings', all);
  res.json(all[i]);
});

app.get('/api/staff', auth, (_, res) => res.json(read('staff')));

app.post('/api/staff', auth, (req, res) => {
  const b = req.body || {};
  if (!clean(b.name) || !clean(b.phone)) return res.status(400).json({ error: 'Name and phone required' });
  const record = {
    id: uuid(),
    name: clean(b.name),
    phone: clean(b.phone),
    role: clean(b.role) || 'Usher',
    availability: clean(b.availability) || 'available',
    createdAt: now(),
  };
  const all = read('staff');
  all.push(record);
  write('staff', all);
  res.status(201).json(record);
});

app.patch('/api/staff/:id', auth, (req, res) => {
  const all = read('staff');
  const i = all.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Staff not found' });
  for (const k of ['name', 'phone', 'role', 'availability']) {
    if (k in req.body) all[i][k] = clean(req.body[k]);
  }
  write('staff', all);
  res.json(all[i]);
});

app.get('/api/quotes', auth, (_, res) => res.json(read('quotes')));

app.post('/api/quotes', auth, (req, res) => {
  const b = req.body || {};
  if (!b.bookingId) return res.status(400).json({ error: 'bookingId required' });
  const subtotal = Number(b.subtotal || 0);
  const discount = Number(b.discount || 0);
  const tax = Number(b.tax || 0);
  const record = {
    id: uuid(),
    reference: 'Q-' + Date.now().toString().slice(-7),
    bookingId: b.bookingId,
    subtotal,
    discount,
    tax,
    total: Math.max(0, subtotal - discount + tax),
    status: 'draft',
    createdAt: now(),
  };
  const all = read('quotes');
  all.push(record);
  write('quotes', all);
  res.status(201).json(record);
});

app.patch('/api/quotes/:id', auth, (req, res) => {
  const all = read('quotes');
  const i = all.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Quote not found' });
  if ('status' in req.body) all[i].status = clean(req.body.status);
  write('quotes', all);
  res.json(all[i]);
});

app.get('/api/payments', auth, (_, res) => res.json(read('payments')));

app.post('/api/payments', auth, (req, res) => {
  const b = req.body || {};
  if (!b.bookingId || !b.amount) return res.status(400).json({ error: 'bookingId and amount required' });
  const record = {
    id: uuid(),
    bookingId: b.bookingId,
    amount: Number(b.amount),
    method: clean(b.method) || 'cash',
    status: 'recorded',
    reference: 'PAY-' + Date.now().toString().slice(-7),
    createdAt: now(),
  };
  const all = read('payments');
  all.push(record);
  write('payments', all);
  res.status(201).json(record);
});

app.get('/api/stats', auth, (_, res) => {
  const b = read('bookings');
  const s = read('staff');
  const q = read('quotes');
  const p = read('payments');
  res.json({
    totalBookings: b.length,
    pending: b.filter((x) => x.status === 'pending').length,
    confirmed: b.filter((x) => x.status === 'confirmed').length,
    completed: b.filter((x) => x.status === 'completed').length,
    cancelled: b.filter((x) => x.status === 'cancelled').length,
    staff: s.length,
    availableStaff: s.filter((x) => x.availability === 'available').length,
    quotes: q.length,
    revenue: p.reduce((n, x) => n + x.amount, 0),
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Velderr API ready on port ${PORT}`));
