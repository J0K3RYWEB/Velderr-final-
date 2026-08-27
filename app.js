const API = window.VELDERR_API_BASE || 'http://localhost:4000/api';

// Fallback data so the site still works if the API is unreachable (e.g. static hosting demo).
const FALLBACK_SERVICES = [
  { name: 'Event Ushering', desc: 'Professional ushers for conferences, weddings, corporate events and concerts.' },
  { name: 'VIP Management', desc: 'Premium guest reception, protocol and discreet assistance.' },
  { name: 'Crowd Control', desc: 'Safe, orderly guest movement and event-flow support.' },
  { name: 'Event Support', desc: 'Registration, directions, guest assistance and on-site coordination.' },
  { name: 'Brand Representation', desc: 'Polished staff who represent your brand with integrity and elegance.' },
];
const FALLBACK_PACKAGES = [
  { id: 'bronze', name: 'Bronze', minGuests: 50, maxGuests: 100, ushers: 5, price: 500000 },
  { id: 'silver', name: 'Silver', minGuests: 101, maxGuests: 250, ushers: 10, price: 1200000 },
  { id: 'gold', name: 'Gold', minGuests: 251, maxGuests: 500, ushers: 15, price: 2000000 },
  { id: 'platinum', name: 'Platinum', minGuests: 501, maxGuests: 750, ushers: 20, price: 3000000 },
  { id: 'diamond', name: 'Diamond', minGuests: 751, maxGuests: 1000, ushers: 25, price: 4500000 },
  { id: 'double-diamond', name: 'Double Diamond', minGuests: 1001, maxGuests: 1500, ushers: 30, price: 5000000 },
  { id: 'triple-diamond', name: 'Triple Diamond', minGuests: 1501, maxGuests: 2000, ushers: 40, price: 6000000 },
];

let PACKAGES = FALLBACK_PACKAGES;
let selectedPackage = null;

const $ = (sel) => document.querySelector(sel);
const fmtUGX = (n) => n.toLocaleString('en-US') + ' UGX';

const nav = $('#nav');
const menuBtn = $('.menu');
menuBtn?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});

function pkgForGuests(guests) {
  return PACKAGES.find((p) => guests <= p.maxGuests) || PACKAGES[PACKAGES.length - 1];
}

function renderPackageGrid() {
  const grid = $('#packageGrid');
  if (!grid) return;
  grid.innerHTML = PACKAGES.map((p) => `
    <article class="pkg-card" data-name="${p.name}" tabindex="0" role="button">
      <p class="pkg-name">${p.name}</p>
      <p class="pkg-meta">${p.minGuests}–${p.maxGuests} guests · ${p.ushers} ushers</p>
      <p class="pkg-price">${fmtUGX(p.price)}</p>
    </article>
  `).join('');
  grid.querySelectorAll('.pkg-card').forEach((card) => {
    const activate = () => {
      selectPackage(card.dataset.name);
      document.querySelector('#booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
}

function selectPackage(name) {
  selectedPackage = name;
  document.querySelectorAll('.pkg-card').forEach((c) => c.classList.toggle('active', c.dataset.name === name));
  const select = $('#f-package');
  if (select) select.value = name;
}

function updateCalculator() {
  const guests = Number($('#guestSlider').value);
  $('#guestNum').textContent = guests >= 2000 ? '2000+' : guests;
  const p = pkgForGuests(guests);
  $('#resPkgName').textContent = p.name + ' Package';
  $('#resPkgMeta').textContent = `${p.ushers} ushers · ${p.minGuests}–${p.maxGuests} guests`;
  $('#resPrice').textContent = fmtUGX(p.price);
  $('#calcCta').textContent = `Book the ${p.name} Package`;
  $('#f-guests').value = guests;
  selectPackage(p.name);
}

async function init() {
  try {
    const [services, packages] = await Promise.all([
      fetch(API + '/public/services').then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(API + '/public/packages').then((r) => (r.ok ? r.json() : Promise.reject())),
    ]);
    renderServices(services);
    PACKAGES = packages;
  } catch (e) {
    renderServices(FALLBACK_SERVICES);
    PACKAGES = FALLBACK_PACKAGES;
  }
  renderPackageGrid();
  const packageSelect = $('#f-package');
  if (packageSelect) {
    packageSelect.innerHTML = '<option value="">Let us recommend one</option>' +
      PACKAGES.map((p) => `<option>${p.name}</option>`).join('');
  }
  updateCalculator();
}

function renderServices(services) {
  $('#serviceGrid').innerHTML = services.map((s) => `
    <article class="card">
      <div class="icon">✦</div>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
    </article>
  `).join('');
  const serviceSelect = $('#f-service');
  serviceSelect.innerHTML = '<option value="">Choose a service</option>' +
    services.map((s) => `<option>${s.name}</option>`).join('');
}

$('#guestSlider')?.addEventListener('input', updateCalculator);

$('#f-package')?.addEventListener('change', (e) => selectPackage(e.target.value));

$('#bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  payload.guests = Number(payload.guests || 0);
  payload.budget = Number(payload.budget || 0);
  const resultEl = $('#result');
  resultEl.textContent = 'Sending your request…';
  try {
    const r = await fetch(API + '/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Something went wrong');
    resultEl.textContent = `Request received — reference ${data.reference}. We'll be in touch shortly.`;
    form.reset();
    updateCalculator();
  } catch (err) {
    const body = encodeURIComponent(Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join('\n'));
    resultEl.textContent = "Couldn't reach our booking system — opening email instead.";
    window.location.href = `mailto:velderr256@gmail.com?subject=Velderr%20Booking%20Request&body=${body}`;
  }
});

init();
