import { $, $$, html, render, api, icon, productImage, productArt, rail, bindProductActions, buyControl, money, titleCase, discountPct, cart } from '../lib.js';

export default async function product(view, { args, config }) {
  render(view, html`<div class="wrap"><div class="pdp" style="padding-top:20px"><div class="skel" style="aspect-ratio:1/1"></div><div><div class="skel" style="height:34px;width:80%"></div><div class="skel" style="height:18px;width:50%;margin-top:12px"></div><div class="skel" style="height:120px;margin-top:20px"></div></div></div></div>`);
  const { product: p, similar } = await api(`/products/${args[0]}`);
  const off = discountPct(p);
  document.title = `${titleCase(p.name)} · Dipti Medical`;
  const specs = [
    ['Salt / composition', p.composition],
    ['Strength', p.strength],
    ['Pack size', p.packSize],
    ['Type', p.type?.name],
    ['Category', p.category?.name],
    ['Company', p.manufacturer],
  ].filter(([, v]) => v);

  render(
    view,
    html`<div class="wrap">
      <div class="page-head" style="padding-bottom:4px"><div class="crumbs"><a href="#/">Home</a>›${p.category ? html`<a href="#/category/${p.category._id}">${titleCase(p.category.name)}</a>›` : ''}<span>${titleCase(p.name)}</span></div></div>
      <div class="pdp">
        <div class="gallery">
          <div class="gallery__main" data-main>${productImage(p)}</div>
          ${p.images?.length > 1 ? html`<div class="gallery__thumbs">${p.images.map((src, i) => html`<button type="button" class="${i ? '' : 'is-active'}" data-img="${src}" aria-label="Photo ${i + 1}"><img src="${src}" alt="" /></button>`)}</div>` : ''}
        </div>
        <div>
          <h1 class="pdp__name">${titleCase(p.name)}</h1>
          ${p.manufacturer ? html`<div class="pdp__by">By <a href="#/search?q=${encodeURIComponent(p.manufacturer)}">${titleCase(p.manufacturer)}</a></div>` : ''}
          <div class="pdp__tags">
            ${p.inStock ? html`<span class="ptag ptag--ok">${icon('check')}In stock</span>` : html`<span class="ptag ptag--bad">Out of stock</span>`}
            ${p.prescriptionRequired ? html`<span class="ptag ptag--rx">Prescription required</span>` : ''}
            ${p.type ? html`<span class="ptag">${p.type.name}</span>` : ''}
          </div>
          ${p.composition ? html`<div class="pdp__by">Salt: <a href="#/search?q=${encodeURIComponent(p.composition)}">${titleCase(p.composition)}</a></div>` : ''}

          <div class="pdp__pricebox">
            ${p.price > 0
              ? html`<div class="pdp__price"><span class="price">${money(p.price)}</span>${p.mrp > p.price ? html`<span class="mrp">MRP ${money(p.mrp)}</span><span class="tag tag--off">${off}% OFF</span>` : ''}</div><div class="pdp__tax">Inclusive of all taxes</div>`
              : html`<div class="pdp__price"><span class="price" style="font-size:1.15rem">Price available on call</span></div><div class="pdp__tax">Call ${config.phone} and we'll arrange it for you.</div>`}
            <div class="pdp__buy" data-cta="${p._id}" data-large="1">${buyControl(p, config.phone, { large: true })}</div>
          </div>

          ${p.prescriptionRequired ? html`<div class="notice notice--rx">${icon('rx')}<span>This medicine needs a valid prescription. You'll be asked to upload a photo of it at checkout, and our pharmacist will check it before dispatch.</span></div>` : ''}
          <div class="notice notice--info">${icon('truck')}<span>Minimum order value is <strong>${money(config.minOrderValue)}</strong>. Pay securely online with UPI, cards or netbanking.</span></div>

          ${specs.length ? html`<dl class="specs">${specs.map(([k, v]) => html`<div><dt>${k}</dt><dd>${titleCase(v)}</dd></div>`)}</dl>` : ''}
          ${p.description ? html`<section class="section"><h2 class="section__title" style="font-size:1.05rem">About this product</h2><p class="prose">${p.description}</p></section>` : ''}
          <p class="muted" style="font-size:.76rem;margin-top:16px">Information is for reference only. Always follow your doctor's advice and read the label before use.</p>
        </div>
      </div>
      ${similar.length ? html`<section class="section"><div class="section__head"><h2 class="section__title">${p.composition ? 'Same salt, other brands' : 'You may also like'}</h2></div>${rail(similar, config.phone)}</section>` : ''}
    </div>
    <div class="sticky-buy" data-sticky>
      <div>${p.price > 0 ? html`<span class="price">${money(p.price)}</span>${p.mrp > p.price ? html` <span class="mrp">${money(p.mrp)}</span>` : ''}` : html`<strong style="font-size:.9rem">Price on call</strong>`}</div>
      <div data-cta="${p._id}" style="flex:1;display:flex;justify-content:flex-end">${buyControl(p, config.phone)}</div>
    </div>`
  );
  document.body.classList.add('has-sticky');

  bindProductActions(view, [p, ...similar], config.phone);
  // keep sticky bar & main button in sync
  const unsub = cart.onChange(() => {
    if (!document.body.contains(view.querySelector('.pdp'))) return unsub();
    $$(`[data-cta="${p._id}"]`, view).forEach((slot) => render(slot, buyControl(p, config.phone, { large: slot.dataset.large === '1' })));
  });
  view.addEventListener('click', (e) => {
    const t = e.target.closest('[data-img]');
    if (!t) return;
    $('[data-main]', view).innerHTML = `<img src="${t.dataset.img}" alt="" />`;
    $$('[data-img]', view).forEach((b) => b.classList.toggle('is-active', b === t));
  });
  void productArt;
}
