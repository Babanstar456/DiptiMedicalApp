import { $, $$, html, raw, render, api, auth, cart, icon, money, titleCase, loginUrl, toast, pay, withLoading, uploadPrescription } from '../lib.js';

const FIELDS = [
  ['name', 'Full name', 'text', 'name', true],
  ['phone', 'Mobile number', 'tel', 'tel', true],
  ['line1', 'House / flat, street', 'text', 'address-line1', true],
  ['line2', 'Area / locality', 'text', 'address-line2', false],
  ['landmark', 'Landmark (optional)', 'text', 'off', false],
  ['city', 'City / town', 'text', 'address-level2', true],
  ['pincode', 'PIN code', 'text', 'postal-code', true],
];

export default async function checkout(view, { config }) {
  const user = await auth.ready;
  if (!user) {
    location.replace(loginUrl('#/checkout'));
    return;
  }
  if (!cart.items.length) {
    location.hash = '#/cart';
    return;
  }
  const sub = cart.subtotal();
  if (sub < config.minOrderValue) {
    toast(`Minimum order is ${money(config.minOrderValue)}`, 'error');
    location.hash = '#/cart';
    return;
  }
  const profile = auth.profile || (await api('/my/me', { auth: true })).user;
  const saved = profile.addresses || [];
  const needsRx = cart.needsRx();
  let rx = null;

  render(
    view,
    html`<div class="wrap">
      <div class="page-head"><div class="crumbs"><a href="#/cart">Cart</a>›<span>Checkout</span></div><h1 class="page-title">Checkout</h1></div>
      <div class="two-col">
        <div>
          <section class="scard">
            <h2 class="scard__title"><span class="step">1</span>Delivery details</h2>
            <p class="muted" style="margin:-6px 0 12px;font-size:.8rem">Name, mobile number and address are required to place an order.</p>
            ${saved.length ? html`<div class="addr-list">${saved.map(
              (a, i) => html`<label class="addr"><input type="radio" name="addr" value="${i}" ${i === 0 ? 'checked' : ''} /><span><strong>${a.name}</strong> · ${a.phone}<br />${[a.line1, a.line2, a.landmark, `${a.city} - ${a.pincode}`].filter(Boolean).join(', ')}</span></label>`
            )}<label class="addr"><input type="radio" name="addr" value="new" /><span><strong>Deliver to a new address</strong></span></label></div>` : ''}
            <div class="form-grid" data-newaddr ${saved.length ? 'hidden' : ''}>
              ${FIELDS.map(
                ([k, label, type, ac, req]) => html`<div class="sfield ${['line1', 'line2'].includes(k) ? 'full' : ''}"><label for="a_${k}">${label}</label><input class="sinput" id="a_${k}" name="${k}" type="${type}" autocomplete="${ac}" ${req ? 'required' : ''} ${raw(k === 'pincode' ? 'inputmode="numeric" maxlength="6" pattern="[0-9]{6}"' : k === 'phone' ? 'inputmode="tel" maxlength="13"' : '')} value="${k === 'name' ? profile.displayName || '' : k === 'phone' ? profile.phoneNumber || '' : ''}" /></div>`
              )}
              <p class="muted full" style="margin:0;font-size:.78rem">${icon('check')} This name, phone number and address are saved to your account for future orders.</p>
            </div>
          </section>

          ${needsRx ? html`<section class="scard">
            <h2 class="scard__title"><span class="step">2</span>Prescription</h2>
            <label class="upload"><input type="file" accept="image/*" data-rx /><span class="upload__thumb" data-rxthumb>${icon('camera')}</span><span><strong data-rxlabel>Add a photo of your prescription</strong><small>Required for prescription medicines. Only our pharmacists can see it.</small></span></label>
          </section>` : ''}

          <section class="scard">
            <h2 class="scard__title"><span class="step">${needsRx ? 3 : 2}</span>Notes for the pharmacy <span class="muted" style="font-weight:400;font-size:.8rem">(optional)</span></h2>
            <textarea class="stextarea" data-notes maxlength="500" placeholder="E.g. call before delivery, substitute brand OK"></textarea>
          </section>
        </div>
        <aside>
          <div class="scard">
            <h2 class="scard__title">Your order</h2>
            ${cart.items.map((i) => html`<div class="sumrow"><span>${titleCase(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`)}
            <div class="sumrow"><span>Delivery</span><span style="color:var(--brand-700)">Free</span></div>
            <div class="sumrow sumrow--total"><span>Total</span><span>${money(sub)}</span></div>
            <p class="form-error" data-error hidden></p>
            <button class="sbtn sbtn--primary sbtn--block sbtn--lg" type="button" data-pay style="margin-top:12px">${icon('lock')}Pay ${money(sub)} securely</button>
            <p class="muted" style="font-size:.74rem;text-align:center;margin:10px 0 0">UPI, cards, netbanking & wallets via Razorpay</p>
          </div>
        </aside>
      </div>
    </div>
    <div class="checkout-bar"><div><strong>${money(sub)}</strong><small>Free delivery</small></div><button class="sbtn sbtn--primary" type="button" data-pay>Pay securely</button></div>`
  );
  document.body.classList.add('has-sticky');
  const errorEl = $('[data-error]', view);
  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    toast(msg, 'error');
  };

  $$('input[name="addr"]', view).forEach((r) => r.addEventListener('change', () => ($('[data-newaddr]', view).hidden = r.value !== 'new' || !r.checked)));

  $('[data-rx]', view)?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    $('[data-rxlabel]', view).textContent = 'Uploading…';
    try {
      rx = await uploadPrescription(file);
      $('[data-rxthumb]', view).innerHTML = `<img src="${rx.preview}" alt="Prescription" />`;
      $('[data-rxlabel]', view).textContent = 'Prescription added. Tap to change.';
    } catch (err) {
      rx = null;
      $('[data-rxlabel]', view).textContent = 'Add a photo of your prescription';
      showError(err.message);
    }
  });

  function readAddress() {
    const choice = $('input[name="addr"]:checked', view)?.value;
    if (choice && choice !== 'new') return { address: saved[Number(choice)] };
    const a = {};
    for (const [k, , , , req] of FIELDS) {
      const input = $(`#a_${k}`, view);
      if (req && !input.checkValidity()) {
        input.reportValidity();
        input.focus();
        return null;
      }
      a[k] = input.value.trim();
    }
    return { address: a };
  }

  $$('[data-pay]', view).forEach((btn) =>
    btn.addEventListener('click', () =>
      withLoading(btn, async () => {
        errorEl.hidden = true;
        const addr = readAddress();
        if (!addr) return;
        if (needsRx && !rx) return showError('Please add a photo of your prescription.');
        try {
          const res = await api('/my/orders', {
            method: 'POST',
            auth: true,
            body: { items: cart.items.map((i) => ({ product: i.id, quantity: i.qty })), ...addr, prescriptionImage: rx?.id, notes: $('[data-notes]', view).value },
          });
          const orderId = res.order._id;
          const result = await pay(res.payment);
          cart.clear();
          location.hash = result ? `#/order/${orderId}?paid=1` : `#/order/${orderId}`;
          if (!result) toast('Payment not completed. You can pay from this page.', 'error');
        } catch (err) {
          showError(err.message);
        }
      })
    )
  );
}
