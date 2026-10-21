import { $, $$, html, raw, render, api, art, icon, rail, bindProductActions, money, titleCase } from '../lib.js';
import { searchBox } from '../app.js';

const POPULAR = ['Paracetamol', 'Vitamin D3', 'Pantoprazole', 'Cetirizine', 'ORS', 'Baby care'];

const heroArt = (side) =>
  raw(`<svg class="hero__art hero__art--${side}" viewBox="0 0 220 220" aria-hidden="true" fill="none">
    ${side === 'l'
      ? '<circle cx="110" cy="110" r="90" fill="#ffffff10"/><g transform="rotate(-30 110 110)"><rect x="50" y="88" width="120" height="44" rx="22" fill="#fff"/><path d="M110 88h38a22 22 0 0 1 0 44h-38z" fill="#7be0b5"/></g><circle cx="58" cy="58" r="14" fill="#ffd666"/><circle cx="170" cy="168" r="10" fill="#7be0b5"/>'
      : '<circle cx="110" cy="110" r="90" fill="#ffffff10"/><rect x="72" y="52" width="76" height="116" rx="16" fill="#fff"/><rect x="86" y="36" width="48" height="22" rx="6" fill="#7be0b5"/><path d="M110 90v40M90 110h40" stroke="#0b9467" stroke-width="12" stroke-linecap="round"/><circle cx="168" cy="56" r="12" fill="#ffd666"/>'}
  </svg>`);

function carousel(config) {
  const slides = [
    { cls: 'slide--1', tag: 'SHOP ONLINE', title: 'Genuine medicines, delivered', text: `Order from ${config.name || 'Dipti Medical'} with secure Razorpay payments. Minimum order ${money(config.minOrderValue)}.`, cta: ['Shop bestsellers', '#/search?featured=1'], icon: 'star' },
    { cls: 'slide--2', tag: 'DOCTOR CONSULTATION', title: `Book a doctor for just ${money(config.consultTokenAmount)}`, text: 'Pick a time that suits you and pay a small token online. The rest is paid at the clinic.', cta: ['Book appointment', '#/doctors'], icon: 'doctor' },
    { cls: 'slide--3', tag: 'NO SEARCHING NEEDED', title: 'Upload medicine prescription', text: 'Send a photo of your prescription and our staff will call you to confirm your order.', cta: ['Upload now', '#/upload'], icon: 'rxdoc' },
  ];
  return html`<div class="carousel" aria-roledescription="carousel" aria-label="Offers">
    <div class="carousel__track">${slides.map(
      (s, i) => html`<div class="slide ${s.cls}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${slides.length}">
        <div class="slide__text"><span class="slide__tag">${s.tag}</span><h3>${s.title}</h3><p>${s.text}</p><a class="sbtn sbtn--sm" href="${s.cta[1]}">${s.cta[0]}</a></div>
        <div class="slide__art">${art(s.icon, 220)}</div></div>`
    )}</div>
    <button class="carousel__nav carousel__nav--prev" type="button" aria-label="Previous">${icon('left')}</button>
    <button class="carousel__nav carousel__nav--next" type="button" aria-label="Next">${icon('right')}</button>
    <div class="carousel__dots">${slides.map((s, i) => html`<button type="button" aria-label="Slide ${i + 1}" data-dot="${i}"></button>`)}</div>
  </div>`;
}

function wireCarousel(root) {
  const track = $('.carousel__track', root);
  const n = track.children.length;
  let i = 0;
  let timer;
  const go = (k) => {
    i = (k + n) % n;
    track.style.transform = `translateX(${-i * 100}%)`;
    $$('[data-dot]', root).forEach((d, j) => d.classList.toggle('is-active', j === i));
  };
  const auto = () => {
    clearInterval(timer);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => document.body.contains(root) ? go(i + 1) : clearInterval(timer), 5000);
  };
  $('.carousel__nav--prev', root).onclick = () => (go(i - 1), auto());
  $('.carousel__nav--next', root).onclick = () => (go(i + 1), auto());
  $$('[data-dot]', root).forEach((d) => (d.onclick = () => (go(Number(d.dataset.dot)), auto())));
  let x0 = null;
  track.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  track.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
    x0 = null;
    auto();
  });
  go(0);
  auto();
}

export default async function home(view, { config }) {
  render(
    view,
    html`<section class="hero">${heroArt('l')}${heroArt('r')}<div class="wrap">
        <h1>Medicines & health essentials</h1>
        <p>Genuine products from your trusted local pharmacy. Search by medicine or salt name.</p>
        <div data-hero-search></div>
        <div class="hero__chips">${POPULAR.map((q) => html`<a href="#/search?q=${encodeURIComponent(q)}">${q}</a>`)}</div>
      </div></section>
      <div class="wrap">
        <div class="quick">
          <a class="qcard qcard--green" href="#/upload"><span class="qcard__icon">${art('rxdoc')}</span><span><strong>Upload medicine prescription</strong><small>Our staff will call you</small></span><svg class="qcard__arrow" viewBox="0 0 24 24"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg></a>
          <a class="qcard qcard--violet" href="#/doctors"><span class="qcard__icon">${art('doctor')}</span><span><strong>Doctor appointment</strong><small>Book for ${money(config.consultTokenAmount)}</small></span><svg class="qcard__arrow" viewBox="0 0 24 24"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg></a>
          <a class="qcard qcard--amber" href="tel:+91${config.phone}"><span class="qcard__icon">${art('call')}</span><span><strong>Call to order</strong><small>${config.phone}</small></span><svg class="qcard__arrow" viewBox="0 0 24 24"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg></a>
          <a class="qcard qcard--blue" href="#/search?featured=1"><span class="qcard__icon">${art('star')}</span><span><strong>Bestsellers</strong><small>Most bought</small></span><svg class="qcard__arrow" viewBox="0 0 24 24"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg></a>
        </div>
        <section class="section" data-carousel>${carousel(config)}</section>
        <div data-body><div class="section"><div class="skel" style="height:180px"></div></div><div class="section"><div class="rail"><div class="rail__track">${Array.from({ length: 5 }, () => raw('<div class="skel skel-card"></div>'))}</div></div></div></div>
      </div>`
  );
  $('[data-hero-search]', view).append(searchBox({ placeholder: 'Search medicines, e.g. Calpol, Paracetamol' }));
  wireCarousel($('[data-carousel]', view));

  const data = await api('/home');
  const all = data.rails.flatMap((r) => r.items);
  render(
    $('[data-body]', view),
    html`
      ${data.conditions.length
        ? html`<section class="section"><div class="section__head"><div><h2 class="section__title">Browse by health condition</h2><p class="section__sub">Medicines matched by their salt</p></div></div>
          <div class="tiles-grid tiles-grid--5">${data.conditions.map(
            (c) => html`<a class="ctile" href="#/condition/${c.slug}"><span class="ctile__icon">${art(c.icon)}</span><span><strong>${c.name}</strong><small>${c.count} products</small></span></a>`
          )}</div></section>`
        : ''}
      ${data.rails.map(
        (r) => html`<section class="section"><div class="section__head"><h2 class="section__title">${titleCase(r.title)}</h2><a class="link-more" href="${r.link}">See all</a></div>${rail(r.items, config.phone)}</section>`
      )}
      ${data.categories.length
        ? html`<section class="section"><div class="section__head"><h2 class="section__title">Shop by category</h2><a class="link-more" href="#/categories">All categories</a></div>
          <div class="tiles-grid">${data.categories.map(
            (c) => html`<a class="ctile" href="#/category/${c._id}"><span class="ctile__icon">${c.image ? html`<img src="${c.image}" alt="" />` : art(categoryIcon(c.name))}</span><span><strong>${titleCase(c.name)}</strong><small>${c.productCount} products</small></span></a>`
          )}</div></section>`
        : ''}
      ${data.doctors.length
        ? html`<section class="section"><div class="section__head"><div><h2 class="section__title">Consult our doctors</h2><p class="section__sub">Book a slot with a ${money(config.consultTokenAmount)} token</p></div><a class="link-more" href="#/doctors">All doctors</a></div>
          <div class="drail">${data.doctors.map(
            (d) => html`<div class="dcard"><div class="dcard__photo">${d.photo ? html`<img src="${d.photo}" alt="" />` : d.name.replace(/^dr\.?\s*/i, '')[0]}</div><div><h3>${d.name}</h3><p>${d.specialization || ''}</p><p class="muted">${d.qualification || ''}</p><a class="sbtn sbtn--primary sbtn--sm" href="#/doctor/${d._id}">Book now</a></div></div>`
          )}</div></section>`
        : ''}
      <section class="section"><div class="trust">
        <div>${icon('shield')}<span><strong>100% genuine</strong>Sourced from licensed distributors</span></div>
        <div>${icon('lock')}<span><strong>Secure payments</strong>Cards, UPI & netbanking via Razorpay</span></div>
        <div>${icon('pharmacist')}<span><strong>Pharmacist checked</strong>Every order verified</span></div>
        <div>${icon('phone')}<span><strong>Call ${config.phone}</strong>We're happy to help</span></div>
      </div></section>`
  );
  bindProductActions(view, all, config.phone);
}

export function categoryIcon(name = '') {
  const n = name.toLowerCase();
  if (n.includes('baby')) return 'heart';
  if (n.includes('personal')) return 'sparkle';
  if (n.includes('surgical') || n.includes('device')) return 'shield';
  if (n.includes('nutrition') || n.includes('drink')) return 'leaf';
  if (n.includes('ayur') || n.includes('herbal')) return 'leaf';
  return 'rxdoc';
}
