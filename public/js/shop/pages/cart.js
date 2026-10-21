import { $, html, render, api, cart, icon, productImage, money, titleCase, emptyState, loginUrl, auth } from '../lib.js';

export default async function cartPage(view, { config }) {
  const min = config.minOrderValue;
  // Refresh prices and availability from the server so the cart never shows stale prices
  const problems = new Map();
  if (cart.items.length) {
    try {
      const { items } = await api(`/products?ids=${cart.items.map((i) => i.id).join(',')}&limit=50`);
      const live = new Map(items.map((p) => [p._id, p]));
      for (const line of cart.items) {
        const p = live.get(line.id);
        if (!p) problems.set(line.id, 'No longer available');
        else if (!p.inStock) problems.set(line.id, 'Out of stock');
        else if (!(p.price > 0)) problems.set(line.id, 'Price not available online. Please call to order.');
        else {
          line.price = p.price;
          line.mrp = p.mrp;
          line.rx = !!p.prescriptionRequired;
        }
      }
      cart.save();
    } catch {
      /* show cached cart */
    }
  }

  function draw() {
    if (!cart.items.length) {
      render(view, html`<div class="wrap">${emptyState('Your cart is empty', 'Search for medicines or browse categories to get started.', html`<a class="sbtn sbtn--primary" href="#/">Start shopping</a>`)}</div>`);
      return;
    }
    const sub = cart.subtotal();
    const short = Math.max(0, min - sub);
    const mrpTotal = cart.items.reduce((s, i) => s + Math.max(i.mrp || 0, i.price) * i.qty, 0);
    const saved = Math.max(0, mrpTotal - sub);
    const blocked = problems.size > 0;
    render(
      view,
      html`<div class="wrap">
        <div class="page-head"><h1 class="page-title">My cart <span class="muted" style="font-size:.9rem;font-weight:500">(${cart.count()} items)</span></h1></div>
        <div class="two-col">
          <div>
            <div class="scard">${cart.items.map(
              (i) => html`<div class="cline">
                <a class="cline__img" href="#/product/${i.id}">${productImage({ name: i.name, images: i.image ? [i.image] : [], type: { name: i.type }, category: { name: i.category } })}</a>
                <div>
                  <a class="cline__name" href="#/product/${i.id}">${titleCase(i.name)}</a>
                  <div class="cline__meta">${money(i.price)} each${i.rx ? ' · Prescription needed' : ''}</div>
                  ${problems.get(i.id) ? html`<div class="cline__warn">${problems.get(i.id)}</div>` : ''}
                  <div class="cline__row">
                    <div class="qty" role="group" aria-label="Quantity"><button type="button" data-dec="${i.id}" aria-label="Remove one">−</button><span>${i.qty}</span><button type="button" data-inc="${i.id}" aria-label="Add one">+</button></div>
                    <strong>${money(i.price * i.qty)}</strong>
                  </div>
                  <button class="linkbtn" type="button" data-remove="${i.id}">Remove</button>
                </div>
              </div>`
            )}</div>
            ${cart.needsRx() ? html`<div class="notice notice--rx">${icon('rx')}<span>Some items need a prescription. You'll upload a photo of it at checkout.</span></div>` : ''}
          </div>
          <aside>
            <div class="scard">
              <h2 class="scard__title">Order summary</h2>
              <div class="sumrow"><span>Items total (MRP)</span><span>${money(mrpTotal)}</span></div>
              ${saved ? html`<div class="sumrow" style="color:var(--brand-700)"><span>You save</span><span>− ${money(saved)}</span></div>` : ''}
              <div class="sumrow"><span>Delivery</span><span style="color:var(--brand-700)">Free</span></div>
              <div class="sumrow sumrow--total"><span>To pay</span><span>${money(sub)}</span></div>
              <div class="progress">
                <div class="progress__bar"><span style="width:${Math.min(100, (sub / min) * 100)}%"></span></div>
                <p>${short ? html`Add <strong>${money(short)}</strong> more to reach the minimum order of ${money(min)}.` : html`${icon('check')} Minimum order of ${money(min)} reached.`}</p>
              </div>
              ${blocked ? html`<p class="form-error">Remove the unavailable items to continue.</p>` : ''}
              <button class="sbtn sbtn--primary sbtn--block sbtn--lg" type="button" data-checkout ${short || blocked ? 'disabled' : ''}>Proceed to checkout</button>
              <a class="sbtn sbtn--ghost sbtn--block" style="margin-top:8px" href="#/">Continue shopping</a>
            </div>
          </aside>
        </div>
      </div>
      <div class="checkout-bar"><div><strong>${money(sub)}</strong><small>${short ? `Add ${money(short)} more` : 'Free delivery'}</small></div><button class="sbtn sbtn--primary" type="button" data-checkout ${short || blocked ? 'disabled' : ''}>Checkout</button></div>`
    );
    document.body.classList.add('has-sticky');
  }

  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-inc],[data-dec],[data-remove],[data-checkout]');
    if (!b) return;
    if (b.dataset.checkout !== undefined) {
      const user = await auth.ready;
      location.href = user ? '#/checkout' : loginUrl('#/checkout');
      return;
    }
    const id = b.dataset.inc || b.dataset.dec || b.dataset.remove;
    const line = cart.items.find((i) => i.id === id);
    if (!line) return;
    const q = b.dataset.remove ? 0 : line.qty + (b.dataset.inc ? 1 : -1);
    cart.set({ _id: id }, q);
    if (!q) problems.delete(id);
    draw();
  });
  draw();
}
