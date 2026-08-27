const API = window.VELDERR_API_BASE || 'https://velderr-api.onrender.com/api';
const $ = (sel) => document.querySelector(sel);
let token = sessionStorage.getItem('velderrToken') || '';

const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token });

async function api(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) signOut();
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function showDashboard() {
  $('#login').hidden = true;
  $('#dash').hidden = false;
  load();
}

function showLogin(message) {
  $('#dash').hidden = true;
  $('#login').hidden = false;
  const err = $('#loginError');
  if (message) {
    err.textContent = message;
    err.hidden = false;
  } else {
    err.hidden = true;
  }
}

function signOut() {
  sessionStorage.removeItem('velderrToken');
  token = '';
  showLogin();
}

async function load() {
  try {
    const [stats, bookings, staff] = await Promise.all([api('/stats'), api('/bookings'), api('/staff')]);

    $('#stats').innerHTML = [
      ['Bookings', stats.totalBookings],
      ['Pending', stats.pending],
      ['Confirmed', stats.confirmed],
      ['Completed', stats.completed],
      ['Staff', stats.staff],
      ['Available', stats.availableStaff],
      ['Quotes', stats.quotes],
      ['Revenue', 'UGX ' + stats.revenue.toLocaleString()],
    ].map(([label, value]) => `
      <div class="stat-card"><p class="eyebrow">${label}</p><h3>${value}</h3></div>
    `).join('');

    $('#bookings').innerHTML = bookings.length ? bookings.map((b) => `
      <div class="booking-row">
        <p class="ref">${b.reference} · ${b.status}</p>
        <h4>${b.name}</h4>
        <p>${b.service}${b.package ? ' · ' + b.package : ''} · ${b.date}${b.time ? ' ' + b.time : ''} · ${b.location || 'Location pending'} · ${b.guests || '—'} guests</p>
        <p>${b.phone}${b.email ? ' · ' + b.email : ''}</p>
        <select onchange="setStatus('${b.id}',this.value)">
          ${['pending', 'confirmed', 'completed', 'cancelled'].map((s) => `<option ${b.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select onchange="assign('${b.id}',this.value)">
          <option value="">Assign staff…</option>
          ${staff.filter((s) => s.availability === 'available').map((s) => `<option value="${s.id}" ${b.assignedStaff?.includes(s.id) ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
    `).join('') : '<p style="color:var(--muted)">No bookings yet.</p>';

    $('#staff').innerHTML = staff.length ? staff.map((s) => `
      <div class="staff-card"><b>${s.name}</b><p>${s.role} · ${s.phone} · ${s.availability}</p></div>
    `).join('') : '<p style="color:var(--muted)">No staff yet.</p>';
  } catch (e) {
    // 401 already routes to sign-in via api(); anything else, surface quietly.
  }
}

window.assign = async (id, staffId) => {
  if (!staffId) return;
  await api('/bookings/' + id, { method: 'PATCH', body: JSON.stringify({ assignedStaff: [staffId] }) });
  load();
};

window.setStatus = async (id, status) => {
  await api('/bookings/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
  load();
};

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('#email').value, password: $('#password').value }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Sign in failed');
    token = data.token;
    sessionStorage.setItem('velderrToken', token);
    showDashboard();
  } catch (err) {
    showLogin(err.message);
  }
});

$('#staffForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api('/staff', { method: 'POST', body: JSON.stringify({ name: $('#sn').value, phone: $('#sp').value, role: $('#sr').value }) });
  e.currentTarget.reset();
  $('#sr').value = 'Usher';
  load();
});

$('#signOut').addEventListener('click', signOut);

if (token) showDashboard(); else showLogin();
