// Shop entry: routing (#/path?query), header search, category strip, hamburger drawer, cart badge.
import { $, $$, html, raw, render, el, esc, icon, api, auth, cart, getConfig, money, titleCase, debounce, loginUrl, toast } from './lib.js';

const ROUTES = [
  [/^\/?$/, () => import('./pages/home.js'), 'home'],
  [/^\/search$/, () => import('./pages/listing.js'), 'home'],
  [/^\/category\/(\w+)$/, () => import('./pages/listing.js'), 'categories'],
  [/^\/condition\/([\w-]+)$/, () => import('./pages/listing.js'), 'categories'],
  [/^\/categories$/, () => import('./pages/categories.js'), 'categories'],
  [/^\/product\/(\w+)$/, () => import('./pages/product.js'), 'home'],
  [/^\/cart$/, () => import('./pages/cart.js'), 'cart'],
  [/^\/checkout$/, () => import('./pages/checkout.js'), 'cart'],
  [/^\/order\/(\w+)$/, () => import('./pages/order.js'), 'account'],
  [/^\/doctors$/, () => import('./pages/doctors.js'), 'doctors'],
  [/^\/doctor\/(\w+)$/, () => import('./pages/doctor.js'), 'doctors'],
  [/^\/upload$/, () => import('./pages/upload.js'), 'home'],
  [/^\/account(?:\/(\w+))?$/, () => import('./pages/account.js'), 'account'],
];

let view = $('#view');
let config = {};
let categories = [];

function parseHash() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  return { path: path || '/', params: Object.fromEntries(new URLSearchParams(query)) };
}

let navToken = 0;
async function route() {
  const { path, params } = parseHash();
  const match = ROUTES.map(([re, load, tab]) => ({ m: path.match(re), load, tab })).find((r) => r.m);
  closeDrawer();
  document.body.classList.remove('has-sticky');
  document.body.classList.toggle('is-home', path === '/');
  $$('.bottomnav a').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === (match?.tab || '')));
  $$('[data-catnav] a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${path}`));

  const token = ++navToken;
  if (!match) {
    render(view, html`<div class="wrap empty-state">${icon('info')}<strong>Page not found</strong><p>Let's get you back to shopping.</p><a class="sbtn sbtn--primary" href="#/">Go to home</a></div>`);
    return;
  }
  try {
    const mod = await match.load();
    if (token !== navToken) return;
    // Fresh element per page so event listeners from the previous page don't pile up
    const fresh = view.cloneNode(false);
    view.replaceWith(fresh);
    view = fresh;
    window.scrollTo(0, 0);
    await mod.default(view, { params, args: match.m.slice(1), config, categories, path });
    if (token === navToken) view.focus({ preventScroll: true });
  } catch (err) {
    console.error(err);
    if (token !== navToken) return;
    render(view, html`<div class="wrap empty-state">${icon('info')}<strong>Something went wrong</strong><p>${err.message}</p><button class="sbtn sbtn--primary" type="button" data-retry>Try again</button></div>`);
    $('[data-retry]', view)?.addEventListener('click', route);
  }
}

/* ---------------- Search box with suggestions ---------------- */
export function searchBox({ placeholder = 'Search medicines, salts & health products', autofocus = false, value = '' } = {}) {
  const box = el(html`<div class="searchbox" role="search">
    <form><label class="sr-only" for="q-${Math.random().toString(36).slice(2, 6)}">Search</label>${icon('search')}<input type="search" name="q" placeholder="${placeholder}" autocomplete="off" enterkeyhint="search" value="${value}" /><button type="submit">Search</button></form>
    <div class="suggest" role="listbox" hidden></div></div>`);
  const input = $('input', box);
  input.id = $('label', box).htmlFor;
  const list = $('.suggest', box);
  let active = -1;

  const show = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) return (list.hidden = true);
    try {
      const items = await api(`/suggest?q=${encodeURIComponent(q)}`);
      if (input.value.trim() !== q) return;
      active = -1;
      render(
        list,
        items.length
          ? html`${items.map(
              (p) => html`<a role="option" href="#/product/${p._id}"><span>${titleCase(p.name)}<small>${titleCase(p.composition || '')}</small></span><span class="price">${p.price > 0 ? money(p.price) : p.inStock ? 'Call' : 'Out'}</span></a>`
            )}<a href="#/search?q=${encodeURIComponent(q)}"><span>See all results for “${q}”</span></a>`
          : html`<a href="#/search?q=${encodeURIComponent(q)}"><span>Search for “${q}”</span></a>`
      );
      list.hidden = false;
    } catch {
      list.hidden = true;
    }
  }, 200);

  input.addEventListener('input', show);
  input.addEventListener('keydown', (e) => {
    const opts = $$('a', list);
    if (list.hidden || !opts.length || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
    opts.forEach((o, i) => o.classList.toggle('is-active', i === active));
    opts[active].focus();
  });
  list.addEventListener('click', () => {
    list.hidden = true;
    input.blur();
  });
  $('form', box).addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    list.hidden = true;
    input.blur();
    if (q) location.hash = `#/search?q=${encodeURIComponent(q)}`;
  });
  document.addEventListener('click', (e) => !box.contains(e.target) && (list.hidden = true));
  if (autofocus) setTimeout(() => input.focus(), 50);
  return box;
}

/* ---------------- Hamburger drawer ---------------- */
const drawer = $('#drawer');
const scrim = $('.drawer-scrim');
function openDrawer() {
  renderDrawer();
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  scrim.hidden = false;
  $('[data-menu-open]').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('[data-menu-close]', drawer).focus(), 50);
}
function closeDrawer() {
  if (!drawer.classList.contains('is-open')) return;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  scrim.hidden = true;
  $('[data-menu-open]').setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}
$('[data-menu-open]').addEventListener('click', openDrawer);
$$('[data-menu-close]').forEach((b) => b.addEventListener('click', closeDrawer));
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawer());

const D = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  grid: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
  star: 'M12 17.3 18.2 21l-1.6-7L22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2 7.4 14l-1.6 7z',
  doctor: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
  rx: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9zM8 14h8v2H8zm0 3h5v2H8z',
  orders: 'M19 3h-4.2a3 3 0 0 0-5.6 0H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 0a1 1 0 1 1-1 1 1 1 0 0 1 1-1zm-2 14-4-4 1.4-1.4L10 14.2l6.6-6.6L18 9z',
  cal: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14z',
  cart: 'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4l1.1-2h7.5a2 2 0 0 0 1.7-1l3.6-6.5A1 1 0 0 0 20.4 4H5.2l-.9-2H1zm16 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  user: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z',
  admin: 'M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-4z',
  logout: 'M10 17l1.4-1.4-2.6-2.6H20v-2H8.8l2.6-2.6L10 7l-5 5 5 5zM4 5h8V3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8v-2H4z',
  heart: 'M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3 6 6 0 0 1 12 5.09 6 6 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z',
};
const dIcon = (k) => raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${D[k]}"/></svg>`);

let conditions = [];
function renderDrawer() {
  const { path } = parseHash();
  const u = auth.user;
  const p = auth.profile;
  const name = p?.displayName || u?.displayName || u?.email?.split('@')[0];
  render(
    $('[data-drawer-user]'),
    u
      ? html`<img src="${p?.photoURL || u.photoURL || '/img/logo-mark.png'}" alt="" /><div style="min-width:0"><strong>Hi, ${titleCase(name || 'there')}</strong><small>${u.email || ''}</small></div>`
      : html`<img src="/img/logo-mark.png" alt="" /><div><strong>Welcome!</strong><small>Sign in for orders & bookings</small><a class="sbtn sbtn--sm" href="${loginUrl()}">Login / Sign up</a></div>`
  );
  const link = (href, ic, text, sub = false) =>
    html`<a href="${href}" class="${sub ? 'drawer__sub' : ''} ${href === `#${path}` ? 'is-active' : ''}">${sub ? '' : dIcon(ic)}${text}</a>`;
  render(
    $('[data-drawer-links]'),
    html`
      ${link('#/', 'home', 'Home')}
      ${link('#/search?featured=1', 'star', 'Bestsellers')}
      ${link('#/upload', 'rx', 'Upload prescription')}
      ${link('#/doctors', 'doctor', 'Book a doctor')}
      ${link('#/cart', 'cart', `My cart${cart.count() ? ` (${cart.count()})` : ''}`)}
      <div class="drawer__group">Shop by category</div>
      ${link('#/categories', 'grid', 'All categories')}
      ${categories.map((c) => link(`#/category/${c._id}`, '', titleCase(c.name), true))}
      ${conditions.length ? html`<div class="drawer__group">Health conditions</div>${conditions.map((c) => link(`#/condition/${c.slug}`, '', c.name, true))}` : ''}
      <div class="drawer__group">My account</div>
      ${link('#/account/orders', 'orders', 'My orders')}
      ${link('#/account/appointments', 'cal', 'My appointments')}
      ${link('#/account/profile', 'user', 'Profile & addresses')}
      ${['admin', 'pharmacist'].includes(p?.role) ? html`<a href="/admin/">${dIcon('admin')}Admin panel</a>` : ''}
      ${u ? html`<button type="button" class="drawer__link" data-signout>${dIcon('logout')}Sign out</button>` : html`<a href="${loginUrl()}">${dIcon('user')}Login / Sign up</a>`}
      <div class="drawer__contact">
        <strong>Need help? We're here.</strong>
        <a href="tel:+91${config.phone}">${icon('phone')}Call ${config.phone}</a>
        <a href="mailto:${config.email}">${icon('mail')}${config.email}</a>
      </div>`
  );
  $('[data-drawer-links]').onclick = async (e) => {
    if (e.target.closest('[data-signout]')) {
      await auth.signOut();
      toast('Signed out');
      closeDrawer();
      location.hash = '#/';
    } else if (e.target.closest('a')) closeDrawer();
  };
}

/* ---------------- Header bits ---------------- */
function updateCartCount() {
  const n = cart.count();
  $$('[data-cart-count]').forEach((c) => {
    c.textContent = n > 99 ? '99+' : n;
    c.hidden = !n;
  });
}
function updateAccount() {
  const u = auth.user;
  const label = u ? titleCase((auth.profile?.displayName || u.displayName || u.email || 'Account').split(' ')[0].split('@')[0]) : 'Login';
  $('[data-account-label]').textContent = label;
  $('[data-account-link]').setAttribute('aria-label', u ? 'My account' : 'Login');
}

async function boot() {
  $('[data-search-slot="desktop"]').append(searchBox());
  $('[data-search-slot="mobile"]').append(searchBox({ placeholder: 'Search medicines & products' }));
  $$('[data-year]').forEach((y) => (y.textContent = new Date().getFullYear()));
  cart.onChange(updateCartCount);
  updateCartCount();
  auth.onChange(updateAccount);
  window.addEventListener('storage', (e) => e.key === 'dm_cart_v1' && location.reload());

  config = await getConfig();
  $$('[data-phone]').forEach((s) => (s.textContent = config.phone));
  $$('[data-email]').forEach((s) => (s.textContent = config.email));
  $$('[data-phone-link]').forEach((a) => (a.href = `tel:+91${config.phone}`));
  $$('[data-email-link]').forEach((a) => (a.href = `mailto:${config.email}`));
  $$('[data-wa-link]').forEach((a) => (a.href = `https://wa.me/91${config.phone}`));
  $$('[data-min-order]').forEach((s) => (s.textContent = money(config.minOrderValue)));

  window.addEventListener('hashchange', route);
  await route();

  try {
    categories = await api('/categories');
    render($('[data-catnav]'), html`<a href="#/categories">All categories</a>${categories.map((c) => html`<a href="#/category/${c._id}">${titleCase(c.name)}</a>`)}`);
    const { path } = parseHash();
    $$('[data-catnav] a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${path}`));
    conditions = (await api('/home').catch(() => ({ conditions: [] }))).conditions || [];
  } catch {
    /* category strip is optional */
  }
  auth.ready.then(updateAccount);
}

boot();
export { esc };
