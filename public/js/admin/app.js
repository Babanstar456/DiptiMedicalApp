// Admin panel entry: checks access, builds the role-based menu and routes between pages (#/page?x=y).
import { $, html, raw, esc, api, toastError } from './core.js';

const NAV = [
  { group: 'Overview' },
  { id: 'dashboard', title: 'Dashboard', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z', load: () => import('./pages/dashboard.js') },
  { group: 'Pharmacy' },
  { id: 'orders', title: 'Orders', icon: 'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4l1.1-2h7.5a2 2 0 0 0 1.7-1l3.6-6.5A1 1 0 0 0 20.4 4H5.2l-.9-2H1zm16 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', load: () => import('./pages/orders.js') },
  { id: 'products', title: 'Products & stock', icon: 'M4.2 13.8a5 5 0 0 1 0-7.1l2.5-2.5a5 5 0 0 1 7.1 7.1l-2.5 2.5-.1.1 6.3 6.3a5 5 0 0 1-7.1 0l-6.2-6.4zM8.1 5.6 5.6 8.1a3 3 0 0 0 0 4.2l1.1 1.1 5.6-5.6-1.1-1.1a3 3 0 0 0-3.1-1.1z', load: () => import('./pages/catalog.js').then((m) => ({ default: m.products })) },
  { group: 'Clinic' },
  { id: 'appointments', title: 'Appointments', icon: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h5v5H7z', load: () => import('./pages/clinic.js').then((m) => ({ default: m.appointments })) },
  { id: 'prescriptions', title: 'Prescription requests', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9zM8 14h8v2H8zm0 3h5v2H8z', load: () => import('./pages/prescriptions.js') },
  { id: 'doctors', title: 'Doctors', icon: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', load: () => import('./pages/clinic.js').then((m) => ({ default: m.doctors })) },
  { group: 'People', admin: true },
  { id: 'staff', title: 'Staff', admin: true, icon: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0h-1c1.2.9 2 2 2 3.5V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z', load: () => import('./pages/hr.js').then((m) => ({ default: m.staff })) },
  { id: 'attendance', title: 'Attendance', admin: true, icon: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z', load: () => import('./pages/hr.js').then((m) => ({ default: m.attendance })) },
  { id: 'payroll', title: 'Payroll', admin: true, icon: 'M11.8 10.9c-2.3-.6-3-1.2-3-2.1 0-1.1 1-1.9 2.7-1.9 1.8 0 2.4.8 2.5 2.1h2.2c-.1-1.7-1.2-3.3-3.2-3.8V3h-3v2.2c-1.9.4-3.5 1.7-3.5 3.6 0 2.3 1.9 3.4 4.7 4.1 2.5.6 3 1.5 3 2.4 0 .7-.5 1.8-2.7 1.8-2.1 0-2.9-.9-3-2.1H6.3c.1 2.2 1.8 3.5 3.7 3.9V21h3v-2.2c1.9-.4 3.5-1.5 3.5-3.6 0-2.8-2.4-3.8-4.7-4.3z', load: () => import('./pages/hr.js').then((m) => ({ default: m.payroll })) },
  { id: 'users', title: 'Users & access', admin: true, icon: 'M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-4zm0 10.99h7c-.5 4.1-3.3 7.8-7 8.9V12H5V6.3l7-3.1v8.8z', load: () => import('./pages/users.js') },
];

const sidebar = $('#sidebar');
const scrim = $('#scrim');
const view = $('#view');
let me;

function openMenu(open) {
  sidebar.classList.toggle('is-open', open);
  scrim.hidden = !open;
  $('#menuBtn').setAttribute('aria-expanded', open);
}
$('#menuBtn').addEventListener('click', () => openMenu(true));
scrim.addEventListener('click', () => openMenu(false));

function parseHash() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { id: path || 'dashboard', params: Object.fromEntries(new URLSearchParams(query)) };
}

let navToken = 0;
async function route() {
  const { id, params } = parseHash();
  const allowed = NAV.filter((n) => n.id && (!n.admin || me.role === 'admin'));
  const page = allowed.find((n) => n.id === id) || allowed[0];
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('is-active', a.dataset.id === page.id));
  openMenu(false);
  // Dialogs belong to the page they were opened from
  $('#modalRoot').replaceChildren();
  document.body.style.overflow = '';

  const token = ++navToken;
  view.innerHTML = '<div class="skeleton-rows"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
  try {
    const mod = await page.load();
    if (token !== navToken) return; // user navigated away while loading
    view.replaceChildren();
    await mod.default(view, params, me);
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    toastError(err);
  }
}

function renderNav() {
  const items = NAV.filter((n) => !n.admin || me.role === 'admin');
  $('#nav').innerHTML = String(
    html`${items.map((n) =>
      n.group
        ? html`<div class="nav__group">${n.group}</div>`
        : html`<a href="#/${n.id}" data-id="${n.id}">${raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${n.icon}"/></svg>`)}<span>${n.title}</span></a>`
    )}`
  );
}

function initials(name) {
  const i = (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#c9eedd"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="600" fill="#066948">${esc(i)}</text></svg>`)}`;
}

function hideSplash(message) {
  const s = $('#splash');
  if (message) {
    $('#splashStatus').textContent = message;
    return;
  }
  s.classList.add('is-hidden');
  setTimeout(() => s.remove(), 500);
}

/* ---------------- Boot ---------------- */
const [{ onAuthStateChanged, signOut }, { auth }] = await Promise.all([
  import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'),
  import('../firebase-init.js'),
]);

$('#signOut').addEventListener('click', async () => {
  await signOut(auth);
  location.replace('/login/');
});

let booted = false;
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.replace('/login/?next=/admin/');
  if (booted) return;
  try {
    ({ user: me } = await api('/api/auth/me'));
  } catch (err) {
    return hideSplash(`Could not load your account: ${err.message}`);
  }
  if (!['admin', 'pharmacist'].includes(me.role)) return location.replace('/');
  booted = true;

  const name = me.displayName || me.email;
  $('#meName').textContent = name;
  $('#meRole').textContent = me.role;
  $('#meAvatar').src = me.photoURL || initials(name);
  $('#meAvatar').addEventListener('error', (e) => (e.target.src = initials(name)), { once: true });

  renderNav();
  window.addEventListener('hashchange', route);
  await route();
  hideSplash();
});
