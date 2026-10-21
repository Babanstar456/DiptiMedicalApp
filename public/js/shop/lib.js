// Shared helpers for the customer shop: templating, API, cart, auth, product cards, payments.

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------------- Safe HTML ---------------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export function html(strings, ...vals) {
  return raw(
    strings.reduce((acc, str, i) => {
      const v = vals[i - 1];
      const piece = v instanceof Raw ? v.s : Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('') : esc(v);
      return acc + piece + str;
    })
  );
}
export const render = (el, tpl) => (el.innerHTML = String(tpl));
export function el(markup) {
  const t = document.createElement('template');
  t.innerHTML = String(markup).trim();
  return t.content.firstElementChild;
}

/* ---------------- Formatting ---------------- */
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const money = (n) => inr.format(Number(n) || 0).replace('.00', '');
export const titleCase = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
export const fmtDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
export const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null && v !== false)).toString();
export const discountPct = (p) => (p.mrp > p.price && p.price > 0 ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0);

/* ---------------- Icons ---------------- */
const P = {
  left: 'M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z',
  right: 'M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  mail: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z',
  cart: 'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4l1.1-2h7.5a2 2 0 0 0 1.7-1l3.6-6.5A1 1 0 0 0 20.4 4H5.2l-.9-2H1zm16 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z',
  rx: 'M5 3h7a5 5 0 0 1 1.6 9.74L17 17l2-2 1.4 1.4-2 2 2 2L19 21.8l-2-2-2 2-1.4-1.4 2-2-4.2-5.4H7V21H5V3zm2 2v6h5a3 3 0 0 0 0-6H7z',
  shield: 'M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-4zm-2 16-4-4 1.4-1.4L10 14.2l6.6-6.6L18 9l-8 8z',
  truck: 'M20 8h-3V4H3a2 2 0 0 0-2 2v11h2a3 3 0 0 0 6 0h6a3 3 0 0 0 6 0h2v-5l-3-4zM6 18.5A1.5 1.5 0 1 1 7.5 17 1.5 1.5 0 0 1 6 18.5zm13.5-9 2 2.5H17V9.5h2.5zM18 18.5a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5z',
  lock: 'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 2-2 2 2 0 0 1-2 2zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0z',
  pharmacist: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm6 2h-2.2a6.9 6.9 0 0 1-7.6 0H6a4 4 0 0 0-4 4v3h20v-3a4 4 0 0 0-4-4zm-5 5h-2v-2H9v-2h2v-2h2v2h2v2h-2z',
  camera: 'M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4zM9 2 7.2 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.2L15 2H9z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  bag: 'M18 6h-2a4 4 0 0 0-8 0H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-6-2a2 2 0 0 1 2 2h-4a2 2 0 0 1 2-2z',
};
export const icon = (name) => raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name]}"/></svg>`);

// Coloured line-art icons for health conditions and quick actions
const C = {
  drop: '<path d="M24 6s-12 13-12 22a12 12 0 0 0 24 0C36 19 24 6 24 6z" fill="#e8f1fa" stroke="#0b63ab" stroke-width="2.5"/><path d="M19 30a5 5 0 0 0 5 5" stroke="#0b63ab" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
  heart: '<path d="M24 40S8 30 8 18a8 8 0 0 1 16-2 8 8 0 0 1 16 2c0 12-16 22-16 22z" fill="#fdecef" stroke="#e5484d" stroke-width="2.5"/><path d="M12 24h7l3-5 4 9 3-4h7" stroke="#e5484d" stroke-width="2.5" fill="none" stroke-linejoin="round"/>',
  pulse: '<rect x="7" y="9" width="34" height="30" rx="8" fill="#fff6e0" stroke="#d08b00" stroke-width="2.5"/><path d="M11 25h7l3-7 5 13 3-6h8" stroke="#d08b00" stroke-width="2.5" fill="none" stroke-linejoin="round"/>',
  stomach: '<path d="M18 7v8c0 4-6 5-6 13a12 12 0 0 0 24 0c0-6-4-9-8-9h-2c-2 0-3-2-3-4V7" fill="#fff1e6" stroke="#e8761a" stroke-width="2.5" stroke-linejoin="round"/>',
  bolt: '<circle cx="24" cy="24" r="17" fill="#fdecef" stroke="#e5484d" stroke-width="2.5"/><path d="M26 11 16 27h8l-2 10 10-16h-8z" fill="#e5484d"/>',
  shield: '<path d="M24 5 9 11v10c0 10 6.5 18 15 21 8.5-3 15-11 15-21V11z" fill="#e8f7f0" stroke="#0b9467" stroke-width="2.5"/><path d="M24 15v16M16 23h16" stroke="#0b9467" stroke-width="3" stroke-linecap="round"/>',
  lungs: '<path d="M24 8v14M24 22c-3 0-5-3-9-3-4 0-6 6-6 14 0 5 3 7 7 7 5 0 7-3 7-8zM24 22c3 0 5-3 9-3 4 0 6 6 6 14 0 5-3 7-7 7-5 0-7-3-7-8z" fill="#e8f1fa" stroke="#0b63ab" stroke-width="2.5" stroke-linejoin="round"/>',
  virus: '<circle cx="24" cy="24" r="10" fill="#f0edfb" stroke="#6b4fc4" stroke-width="2.5"/><path d="M24 6v8M24 34v8M6 24h8M34 24h8M11 11l6 6M31 31l6 6M37 11l-6 6M17 31l-6 6" stroke="#6b4fc4" stroke-width="2.5" stroke-linecap="round"/>',
  leaf: '<path d="M38 8C18 8 9 18 9 30c0 4 2 8 2 8s4-14 18-20C17 26 13 34 13 40c14 0 25-10 25-32z" fill="#e8f7f0" stroke="#0b9467" stroke-width="2.5" stroke-linejoin="round"/>',
  thyroid: '<path d="M24 14c-3-5-14-6-14 6 0 9 7 14 11 12 2-1 3-4 3-7 0 3 1 6 3 7 4 2 11-3 11-12 0-12-11-11-14-6z" fill="#fff1e6" stroke="#e8761a" stroke-width="2.5"/>',
  moon: '<path d="M32 30A14 14 0 0 1 20 10a15 15 0 1 0 18 18 14 14 0 0 1-6 2z" fill="#f0edfb" stroke="#6b4fc4" stroke-width="2.5" stroke-linejoin="round"/><circle cx="34" cy="13" r="2" fill="#6b4fc4"/>',
  sparkle: '<path d="M24 6c2 10 6 14 16 16-10 2-14 6-16 16-2-10-6-14-16-16 10-2 14-6 16-16z" fill="#fdf2fa" stroke="#c4448a" stroke-width="2.5" stroke-linejoin="round"/>',
  rxdoc: '<rect x="10" y="6" width="28" height="36" rx="5" fill="#fff" stroke="#0b9467" stroke-width="2.5"/><path d="M17 15h6a4 4 0 0 1 0 8h-6v-8zm0 8v8M22 23l7 9M17 36h14" stroke="#0b9467" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
  doctor: '<circle cx="24" cy="15" r="8" fill="#fff" stroke="#6b4fc4" stroke-width="2.5"/><path d="M9 42c0-9 7-14 15-14s15 5 15 14" fill="#fff" stroke="#6b4fc4" stroke-width="2.5"/><path d="M19 30v6a4 4 0 0 0 8 0" stroke="#6b4fc4" stroke-width="2.5" fill="none"/><circle cx="27" cy="36" r="2" fill="#6b4fc4"/>',
  call: '<circle cx="24" cy="24" r="18" fill="#fff" stroke="#d08b00" stroke-width="2.5"/><path d="M17 15c1 7 6 13 14 16l3-3-4-3-2 2c-3-1-6-4-7-7l2-2-3-4z" fill="#d08b00"/>',
  star: '<path d="m24 6 5.5 11.5L42 19l-9 8.5L35.5 40 24 33.8 12.5 40 15 27.5 6 19l12.5-1.5z" fill="#fff" stroke="#0b63ab" stroke-width="2.5" stroke-linejoin="round"/>',
};
export const art = (name, size = 28) => raw(`<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" aria-hidden="true">${C[name] || C.leaf}</svg>`);

/* ---------------- Product artwork when there is no photo ---------------- */
const PALETTES = [
  ['#e8f7f0', '#0b9467'],
  ['#e8f1fa', '#0b63ab'],
  ['#fff1e6', '#e8761a'],
  ['#f0edfb', '#6b4fc4'],
  ['#fdecef', '#d6334a'],
  ['#fff6e0', '#b7791f'],
];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const SHAPES = {
  Tablet: (c) => `<rect x="34" y="40" width="92" height="64" rx="12" fill="#fff" stroke="${c}" stroke-width="4"/>${[0, 1, 2].map((i) => `<circle cx="${56 + i * 24}" cy="62" r="9" fill="${c}" opacity=".85"/><circle cx="${56 + i * 24}" cy="86" r="9" fill="${c}" opacity=".55"/>`).join('')}`,
  Capsule: (c) => `<g transform="rotate(-35 80 72)"><rect x="34" y="56" width="92" height="34" rx="17" fill="#fff" stroke="${c}" stroke-width="4"/><path d="M80 56h29a17 17 0 0 1 0 34H80z" fill="${c}"/></g>`,
  'Syrup / Liquid': (c) => `<rect x="62" y="22" width="36" height="16" rx="4" fill="${c}"/><path d="M58 38h44v8c10 4 14 12 14 22v38a10 10 0 0 1-10 10H54a10 10 0 0 1-10-10V68c0-10 4-18 14-22z" fill="#fff" stroke="${c}" stroke-width="4"/><rect x="52" y="74" width="56" height="28" rx="5" fill="${c}" opacity=".25"/>`,
  'Cream / Ointment': (c) => `<g transform="rotate(-25 80 72)"><path d="M40 52h70l14 10v20l-14 10H40z" fill="#fff" stroke="${c}" stroke-width="4"/><rect x="124" y="64" width="14" height="16" rx="3" fill="${c}"/><rect x="52" y="62" width="40" height="20" rx="4" fill="${c}" opacity=".3"/></g>`,
  Drops: (c) => `<rect x="70" y="20" width="20" height="26" rx="6" fill="${c}"/><rect x="58" y="44" width="44" height="72" rx="12" fill="#fff" stroke="${c}" stroke-width="4"/><path d="M80 66s-12 13-12 21a12 12 0 0 0 24 0c0-8-12-21-12-21z" fill="${c}" opacity=".6"/>`,
  Injection: (c) => `<g transform="rotate(-40 80 72)"><rect x="40" y="62" width="70" height="22" rx="4" fill="#fff" stroke="${c}" stroke-width="4"/><rect x="48" y="66" width="34" height="14" fill="${c}" opacity=".4"/><path d="M110 73h28M30 62v22M22 73h18" stroke="${c}" stroke-width="5" stroke-linecap="round"/></g>`,
  Inhaler: (c) => `<path d="M64 30h32v54H64z" fill="#fff" stroke="${c}" stroke-width="4"/><path d="M58 84h44v20a8 8 0 0 1-8 8H66a8 8 0 0 1-8-8z" fill="${c}"/><rect x="70" y="40" width="20" height="30" rx="4" fill="${c}" opacity=".3"/>`,
  'Powder / Sachet': (c) => `<path d="M46 30h68l-4 84H50z" fill="#fff" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><path d="M46 30l6 10 6-10 6 10 6-10 6 10 6-10 6 10 6-10 6 10 6-10" stroke="${c}" stroke-width="3" fill="none"/><circle cx="80" cy="78" r="16" fill="${c}" opacity=".3"/>`,
  Spray: (c) => `<rect x="60" y="48" width="40" height="68" rx="10" fill="#fff" stroke="${c}" stroke-width="4"/><rect x="68" y="28" width="24" height="20" rx="4" fill="${c}"/><path d="M98 34h14M104 26l10-4M104 42l10 4" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
  Other: (c) => `<path d="M40 50 80 32l40 18v46l-40 18-40-18z" fill="#fff" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><path d="M40 50l40 18 40-18M80 68v46" stroke="${c}" stroke-width="4" fill="none"/><path d="M74 52h12M80 46v12" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
};
export function productArt(p) {
  const [bg, fg] = PALETTES[hash(p.category?.name || p.name) % PALETTES.length];
  const shape = SHAPES[p.type?.name] || SHAPES.Other;
  // Square canvas (artwork drawn in a 160×144 area, centred) so it fills product tiles without bands
  return raw(`<svg viewBox="0 -8 160 160" role="img" aria-label="${esc(p.name)}"><rect y="-8" width="160" height="160" fill="${bg}"/>${shape(fg)}</svg>`);
}
export const productImage = (p, cls = '') =>
  p.images?.length ? html`<img class="${cls}" src="${p.images[0]}" alt="${p.name}" loading="lazy" />` : productArt(p);

/* ---------------- Config & API ---------------- */
let configPromise;
export const getConfig = () => (configPromise ||= fetch('/api/shop/config').then((r) => r.json()).catch(() => ({ phone: '8001506000', email: 'digital.diptimedical@gmail.com', minOrderValue: 200, consultTokenAmount: 100 })));

export async function api(path, { method = 'GET', body, auth: needAuth = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (needAuth) {
    const user = await auth.ready;
    if (!user) throw Object.assign(new Error('Please sign in to continue'), { status: 401 });
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  const res = await fetch(`/api/shop${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Something went wrong (${res.status})`), { status: res.status });
  return data;
}

/* ---------------- Auth (Firebase, loaded in the background) ---------------- */
export const auth = {
  user: null,
  profile: null,
  ready: null,
  listeners: new Set(),
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  async signOut() {
    const [{ signOut }, { auth: fbAuth }] = await Promise.all([import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'), import('../firebase-init.js')]);
    await signOut(fbAuth);
  },
};
auth.ready = new Promise((resolve) => {
  Promise.all([import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'), import('../firebase-init.js')])
    .then(([{ onAuthStateChanged }, { auth: fbAuth }]) => {
      let first = true;
      onAuthStateChanged(fbAuth, async (user) => {
        // Mark sign-in as known first; the profile request below itself waits for auth.ready.
        auth.user = user;
        auth.profile = null;
        if (first) {
          first = false;
          resolve(user);
        } else auth.ready = Promise.resolve(user);
        if (user) {
          try {
            auth.profile = (await api('/my/me', { auth: true })).user;
          } catch {
            /* pages fetch the profile themselves when they need it */
          }
        }
        auth.listeners.forEach((fn) => fn(user));
      });
    })
    .catch((err) => {
      console.warn('Sign-in unavailable', err);
      resolve(null);
    });
});
export const loginUrl = (next = location.hash || '#/') => `/login/?next=${encodeURIComponent(`/${next}`)}`;

/* ---------------- Cart (stored on this device) ---------------- */
const CART_KEY = 'dm_cart_v1';
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
};
export const cart = {
  items: read(),
  listeners: new Set(),
  save() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(this.items));
    } catch {
      /* private mode: cart lives for this visit only */
    }
    this.listeners.forEach((fn) => fn(this));
  },
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  qty(id) {
    return this.items.find((i) => i.id === id)?.qty || 0;
  },
  count() {
    return this.items.reduce((s, i) => s + i.qty, 0);
  },
  subtotal() {
    return Math.round(this.items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
  },
  needsRx() {
    return this.items.some((i) => i.rx);
  },
  set(p, qty) {
    qty = Math.max(0, Math.min(99, qty));
    const line = this.items.find((i) => i.id === p._id || i.id === p.id);
    if (!qty) this.items = this.items.filter((i) => i !== line);
    else if (line) line.qty = qty;
    else
      this.items.push({
        id: p._id,
        name: p.name,
        price: p.price,
        mrp: p.mrp,
        rx: !!p.prescriptionRequired,
        qty,
        image: p.images?.[0] || '',
        type: p.type?.name || '',
        category: p.category?.name || '',
      });
    this.save();
  },
  clear() {
    this.items = [];
    this.save();
  },
};
export const sellable = (p) => p.inStock && p.price > 0;

/* ---------------- Toast ---------------- */
let toastTimer;
export function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast is-visible ${type ? `toast--${type}` : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 3200);
}

/* ---------------- Product card, rail, add-to-cart control ---------------- */
export function buyControl(p, phone, { large = false } = {}) {
  if (!p.inStock) return html`<button class="sbtn sbtn--ghost ${large ? 'sbtn--lg' : ''}" disabled>Out of stock</button>`;
  if (!(p.price > 0)) return html`<a class="sbtn sbtn--outline ${large ? 'sbtn--lg' : ''}" href="tel:+91${phone}">${icon('phone')}Call to order</a>`;
  const q = cart.qty(p._id);
  if (!q) return html`<button class="sbtn sbtn--primary ${large ? 'sbtn--lg' : ''}" data-add="${p._id}">${large ? icon('cart') : ''}Add to cart</button>`;
  return html`<div class="qty ${large ? 'qty--lg' : ''}" role="group" aria-label="Quantity"><button type="button" data-dec="${p._id}" aria-label="Remove one">−</button><span>${q} in cart</span><button type="button" data-inc="${p._id}" aria-label="Add one">+</button></div>`;
}

export function productCard(p, phone) {
  const off = discountPct(p);
  return html`<article class="pcard" data-pid="${p._id}">
    <a class="pcard__img" href="#/product/${p._id}" aria-label="${p.name}">${productImage(p)}</a>
    <div class="pcard__badge">${off ? html`<span class="tag tag--off">${off}% OFF</span>` : ''}${p.prescriptionRequired ? html`<span class="tag tag--rx">Rx</span>` : ''}${!p.inStock ? html`<span class="tag tag--out">Out of stock</span>` : ''}</div>
    <div class="pcard__body">
      <a class="pcard__name" href="#/product/${p._id}">${titleCase(p.name)}</a>
      <div class="pcard__meta">${titleCase(p.manufacturer || p.composition || p.type?.name || '')}</div>
      <div class="pcard__price">${p.price > 0 ? html`<span class="price">${money(p.price)}</span>${p.mrp > p.price ? html`<span class="mrp">${money(p.mrp)}</span>` : ''}` : html`<span class="muted" style="font-size:.78rem">Price on call</span>`}</div>
      <div class="pcard__cta" data-cta="${p._id}">${buyControl(p, phone)}</div>
    </div>
  </article>`;
}

export const rail = (items, phone) =>
  html`<div class="rail"><button class="rail__btn rail__btn--prev" type="button" aria-label="Scroll left" data-rail="-1">${icon('left')}</button><div class="rail__track">${items.map((p) => productCard(p, phone))}</div><button class="rail__btn rail__btn--next" type="button" aria-label="Scroll right" data-rail="1">${icon('right')}</button></div>`;

// One delegated handler for add / + / − buttons and rail arrows anywhere in the view.
export function bindProductActions(root, products, phone) {
  const byId = new Map(products.map((p) => [p._id, p]));
  root.addEventListener('click', (e) => {
    const railBtn = e.target.closest('[data-rail]');
    if (railBtn) {
      const track = railBtn.parentElement.querySelector('.rail__track');
      track.scrollBy({ left: Number(railBtn.dataset.rail) * track.clientWidth * 0.9, behavior: 'smooth' });
      return;
    }
    const b = e.target.closest('[data-add],[data-inc],[data-dec]');
    if (!b) return;
    const id = b.dataset.add || b.dataset.inc || b.dataset.dec;
    const p = byId.get(id);
    if (!p) return;
    const q = cart.qty(id);
    cart.set(p, b.dataset.dec ? q - 1 : q + 1);
    if (b.dataset.add) toast(`Added to cart · ${titleCase(p.name)}`, 'success');
    $$(`[data-cta="${id}"]`, root).forEach((slot) => render(slot, buyControl(p, phone, { large: slot.dataset.large === '1' })));
  });
}

/* ---------------- Images (prescriptions) ---------------- */
export async function resizeImage(file, max = 1600) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('Could not read this image. Please use a JPG or PNG photo.');
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let data = c.toDataURL('image/webp', 0.85);
  if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', 0.85);
  return data;
}
export async function uploadPrescription(file) {
  const data = await resizeImage(file);
  const { id } = await api('/my/uploads', { method: 'POST', body: { data }, auth: true });
  return { id, preview: data };
}

/* ---------------- Razorpay ---------------- */
let rzpScript;
const loadRazorpay = () =>
  (rzpScript ||= new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => {
      rzpScript = null;
      reject(new Error('Could not load the payment window. Check your internet and try again.'));
    };
    document.head.append(s);
  }));

function payingOverlay(text) {
  const o = el(html`<div class="paying" role="status"><div>${text}</div></div>`);
  document.body.append(o);
  return o;
}

// Opens Razorpay Checkout; resolves with the verified result, or null if the customer closed it.
export async function pay(payment) {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: payment.keyId,
      order_id: payment.razorpayOrderId,
      amount: payment.amount,
      currency: payment.currency,
      name: payment.name,
      description: payment.description,
      image: `${location.origin}/img/icon-192.png`,
      prefill: payment.prefill,
      theme: { color: '#0b9467' },
      modal: { ondismiss: () => resolve(null) },
      handler: async (resp) => {
        const overlay = payingOverlay('Confirming your payment…');
        try {
          resolve(await api('/my/payments/verify', { method: 'POST', body: resp, auth: true }));
        } catch (err) {
          reject(err);
        } finally {
          overlay.remove();
        }
      },
    });
    rzp.on('payment.failed', (r) => toast(r.error?.description || 'Payment failed. Please try again.', 'error'));
    rzp.open();
  });
}

export function withLoading(btn, fn) {
  btn.classList.add('is-loading');
  btn.disabled = true;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    });
}

export const statusInfo = {
  'awaiting-payment': ['Payment pending', 'warn'],
  pending: ['Received', 'info'],
  confirmed: ['Confirmed', 'ok'],
  packed: ['Packed', 'info'],
  'out-for-delivery': ['Out for delivery', 'info'],
  delivered: ['Delivered', 'ok'],
  completed: ['Completed', 'ok'],
  cancelled: ['Cancelled', 'bad'],
  'no-show': ['Missed', 'bad'],
  new: ['Received', 'info'],
  called: ['We called you', 'ok'],
  ordered: ['Order placed', 'ok'],
  closed: ['Closed', ''],
};
export const statusBadge = (s) => {
  const [text, kind] = statusInfo[s] || [s, ''];
  return html`<span class="status ${kind ? `status--${kind}` : ''}">${text}</span>`;
};
export const emptyState = (title, text, action = '') => html`<div class="empty-state">${icon('bag')}<strong>${title}</strong><p>${text}</p>${action}</div>`;
export const skeletonGrid = (n = 10) => html`<div class="pgrid">${Array.from({ length: n }, () => raw('<div class="skel skel-card"></div>'))}</div>`;

/* ---------------- Profile helpers ---------------- */
export const HEALTH_CONDITIONS = ['Diabetes', 'High BP', 'Heart disease', 'Thyroid', 'Asthma / COPD', 'Cholesterol', 'Kidney disease', 'Arthritis', 'Allergies', 'Pregnant', 'Breastfeeding'];
export const ageFrom = (dob) => {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
};
export const formatAddress = (a) => [a.line1, a.line2, a.landmark && `Near ${a.landmark}`, `${a.city} - ${a.pincode}`].filter(Boolean).join(', ');

// "Order again": put a past order's items back in the cart at today's prices.
export async function reorder(order) {
  const ids = order.items.map((i) => i.product).filter(Boolean);
  const { items } = await api(`/products?ids=${ids.join(',')}&limit=50`);
  const live = new Map(items.map((p) => [p._id, p]));
  const skipped = [];
  let added = 0;
  for (const line of order.items) {
    const p = live.get(String(line.product));
    if (p && sellable(p)) {
      cart.set(p, cart.qty(p._id) + line.quantity);
      added++;
    } else skipped.push(titleCase(line.name));
  }
  if (added) toast(`${added} item${added === 1 ? '' : 's'} added to cart${skipped.length ? ` · ${skipped.length} not available` : ''}`, 'success');
  else toast('These items are not available right now. Please call us to order.', 'error');
  if (skipped.length) setTimeout(() => toast(`Not available: ${skipped.join(', ')}`), 3400);
  if (added) location.hash = '#/cart';
}
