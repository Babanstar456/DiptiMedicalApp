import {
  $, $$, html, el, raw, api, money, num, fmtDate, fmtDateTime, badge, setPage, button, modal, withLoading, toast, toastError,
  skeleton, emptyState, icon, debounce, qs, label, confirmDialog, printHTML, SHOP, renderFields, readFields, validateFields, openPrivateImage,
} from '../core.js';

/* ---------------- Product search picker ---------------- */
function productPicker(onPick) {
  const box = el(html`<div class="picker"><div class="search">${icon('search')}<input class="input" type="search" placeholder="Search product by name, salt or company…" autocomplete="off" /></div><div class="picker__list" hidden></div></div>`);
  const input = $('input', box);
  const list = $('.picker__list', box);
  let results = [];
  const search = debounce(async () => {
    const q = input.value.trim();
    if (!q) return (list.hidden = true);
    try {
      ({ items: results } = await api(`/products?${qs({ q, isActive: true, limit: 8 })}`));
      list.innerHTML = results.length
        ? String(html`${results.map((p, i) => {
            const why = !p.inStock ? 'Out of stock' : !(p.price > 0) ? 'Price not set' : '';
            return html`<button type="button" class="picker__opt" data-i="${i}" ${raw(why ? 'disabled' : '')}>
              <div><strong>${p.name}</strong><small>${[p.manufacturer, p.composition].filter(Boolean).join(' · ')}</small></div>
              <div class="end">${p.price > 0 ? money(p.price) : ''}<br /><small>${why || 'In stock'}</small></div></button>`;
          })}`)
        : '<div class="empty" style="padding:16px">No products found</div>';
      list.hidden = false;
    } catch (err) {
      toastError(err);
    }
  }, 250);
  input.addEventListener('input', search);
  list.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-i]');
    if (!opt) return;
    onPick(results[opt.dataset.i]);
    input.value = '';
    list.hidden = true;
    input.focus();
  });
  document.addEventListener('click', (e) => !box.contains(e.target) && (list.hidden = true));
  return box;
}

const MAX_QTY = 999;
const age = (dob) => {
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
};

const STATUSES = ['awaiting-payment', 'pending', 'confirmed', 'packed', 'out-for-delivery', 'delivered', 'cancelled'];
const CHIPS = [['', 'All'], ['open', 'Open'], ...STATUSES.map((s) => [s, label(s)])];
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'cod', 'online'];

/* ---------------- New order ---------------- */
function newOrderDialog(onDone) {
  const lines = []; // { product, quantity }
  const body = el('<div></div>');
  const customerFields = [
    { type: 'section', label: 'Customer' },
    { name: 'name', label: 'Name', half: true, placeholder: 'Walk-in customer' },
    { name: 'phone', label: 'Phone', type: 'tel', half: true },
    { name: 'address', label: 'Delivery address', type: 'textarea', hint: 'Leave empty for counter sales' },
  ];
  const payFields = [
    { type: 'section', label: 'Payment' },
    { name: 'channel', label: 'Order type', type: 'select', required: true, half: true, default: 'counter', options: [{ value: 'counter', label: 'Counter sale' }, { value: 'phone', label: 'Phone order' }, { value: 'online', label: 'Online' }] },
    { name: 'status', label: 'Status', type: 'select', required: true, half: true, default: 'delivered', options: STATUSES.filter((s) => !['cancelled', 'awaiting-payment'].includes(s)).map((s) => ({ value: s, label: label(s) })) },
    { name: 'paymentMethod', label: 'Payment method', type: 'select', required: true, half: true, default: 'cash', options: PAYMENT_METHODS.map((v) => ({ value: v, label: v.toUpperCase() })) },
    { name: 'paymentStatus', label: 'Payment status', type: 'select', required: true, half: true, default: 'paid', options: ['paid', 'unpaid'] },
    { name: 'discount', label: 'Discount (₹)', type: 'money', half: true, default: 0 },
    { name: 'prescriptionImage', label: 'Prescription photo', type: 'image', half: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const itemsWrap = el(html`<div><div class="f--section" style="margin-bottom:10px">Items</div></div>`);
  const linesEl = el('<div class="lines"></div>');
  const totalsEl = el('<div class="totals"></div>');
  itemsWrap.append(productPicker(addLine), linesEl, totalsEl);
  const custForm = renderFields(customerFields, {});
  const payForm = renderFields(payFields, {});
  body.append(itemsWrap, el('<div style="height:16px"></div>'), custForm, el('<div style="height:16px"></div>'), payForm);

  function addLine(p) {
    const existing = lines.find((l) => l.product._id === p._id);
    if (existing) existing.quantity = Math.min(MAX_QTY, existing.quantity + 1);
    else lines.push({ product: p, quantity: 1 });
    draw();
  }
  function draw() {
    linesEl.innerHTML = lines.length
      ? String(html`${lines.map(
          (l, i) => html`<div class="line" data-i="${i}">
            <div class="line__name">${l.product.name}<small>${money(l.product.price)} each${l.product.prescriptionRequired ? ' · Rx required' : ''}</small></div>
            <div class="line__total">${money(l.product.price * l.quantity)}</div>
            <div class="stepper"><button type="button" data-step="-1" aria-label="Less">−</button><input type="number" inputmode="numeric" min="1" max="${MAX_QTY}" value="${l.quantity}" aria-label="Quantity" /><button type="button" data-step="1" aria-label="More">+</button></div>
            <button type="button" class="b b--sm b--ghost" data-remove style="justify-self:end">Remove</button>
          </div>`
        )}`)
      : String(emptyState('No items yet', 'Search above to add products.'));
    const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
    const discount = Math.min(subtotal, Number($('[name="discount"]', payForm)?.value) || 0);
    totalsEl.innerHTML = String(html`<div><span>Subtotal (${num(lines.reduce((s, l) => s + l.quantity, 0))} items)</span><span>${money(subtotal)}</span></div>
      <div><span>Discount</span><span>− ${money(discount)}</span></div>
      <div class="grand"><span>Total (incl. GST)</span><span>${money(subtotal - discount)}</span></div>`);
  }
  linesEl.addEventListener('click', (e) => {
    const line = e.target.closest('[data-i]');
    if (!line) return;
    const l = lines[line.dataset.i];
    const step = e.target.closest('[data-step]');
    if (step) l.quantity = Math.max(1, Math.min(MAX_QTY, l.quantity + Number(step.dataset.step)));
    if (e.target.closest('[data-remove]')) lines.splice(line.dataset.i, 1);
    draw();
  });
  linesEl.addEventListener('change', (e) => {
    const line = e.target.closest('[data-i]');
    if (!line || e.target.tagName !== 'INPUT') return;
    const l = lines[line.dataset.i];
    l.quantity = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(e.target.value)) || 1));
    draw();
  });
  payForm.addEventListener('input', (e) => e.target.name === 'discount' && draw());
  draw();

  const save = button('Create order', { kind: 'primary' });
  const cancel = button('Cancel');
  const m = modal({ title: 'New order', body, footer: [cancel, save], wide: true });
  cancel.addEventListener('click', m.close);
  save.addEventListener('click', () =>
    withLoading(save, async () => {
      if (!lines.length) return toast('Add at least one product', 'error');
      if (!validateFields(payForm, payFields)) return;
      const customer = readFields(custForm, customerFields);
      const pay = readFields(payForm, payFields);
      try {
        const order = await api('/orders', {
          method: 'POST',
          body: { ...pay, customer, items: lines.map((l) => ({ product: l.product._id, quantity: l.quantity })) },
        });
        toast(`Order ${order.orderNo} created`, 'success');
        m.close();
        onDone?.();
        orderDetail(order._id, onDone);
      } catch (err) {
        toastError(err);
      }
    })
  );
}

/* ---------------- Invoice ---------------- */
function invoiceHTML(o) {
  return html`<div class="head"><div><h1>${SHOP.name}</h1><div>${SHOP.tagline}</div></div>
      <div style="text-align:right"><strong>Invoice ${o.orderNo}</strong><br />${fmtDateTime(o.createdAt)}<br />${label(o.paymentMethod).toUpperCase()} · ${o.paymentStatus}</div></div>
    <div><strong>Bill to:</strong> ${o.customer?.name || 'Walk-in customer'} ${o.customer?.phone ? `· ${o.customer.phone}` : ''}${o.customer?.address ? html`<br />${o.customer.address}` : ''}</div>
    <table><thead><tr><th>#</th><th>Item</th><th class="r">Rate</th><th class="r">Qty</th><th class="r">GST</th><th class="r">Amount</th></tr></thead><tbody>
      ${o.items.map((i, n) => html`<tr><td>${n + 1}</td><td>${i.name}</td><td class="r">${money(i.price)}</td><td class="r">${i.quantity}</td><td class="r">${i.gstRate}%</td><td class="r">${money(i.total)}</td></tr>`)}
      <tr><td colspan="5" class="r">Subtotal</td><td class="r">${money(o.subtotal)}</td></tr>
      ${o.discount ? html`<tr><td colspan="5" class="r">Discount</td><td class="r">− ${money(o.discount)}</td></tr>` : ''}
      <tr><td colspan="5" class="r">GST included</td><td class="r">${money(o.tax)}</td></tr>
      <tr><td colspan="5" class="r"><strong>Total</strong></td><td class="r"><strong>${money(o.total)}</strong></td></tr>
    </tbody></table><p style="margin-top:16px">Thank you for choosing ${SHOP.name}. Get well soon!</p>`;
}

/* ---------------- Order detail ---------------- */
async function orderDetail(id, onChange) {
  const body = el(String(skeleton(4)));
  const m = modal({ title: 'Order', body, wide: true });
  let o;
  const draw = async () => {
    try {
      o = await api(`/orders/${id}`);
    } catch (err) {
      return (m.body.innerHTML = String(emptyState('Could not load order', err.message)));
    }
    m.root.querySelector('.modal__title').textContent = `Order ${o.orderNo}`;
    const final = o.status === 'cancelled';
    m.body.innerHTML = String(html`
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">${badge(o.status)} ${badge(o.paymentStatus)} <span class="badge">${o.channel}</span></div>
      <div class="lines" style="margin-top:0">${o.items.map(
        (i) => html`<div class="line"><div class="line__name">${i.name}<small>${money(i.price)} × ${i.quantity}</small></div><div class="line__total">${money(i.total)}</div></div>`
      )}</div>
      <div class="totals"><div><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
        ${o.discount ? html`<div><span>Discount</span><span>− ${money(o.discount)}</span></div>` : ''}
        <div><span>GST included</span><span>${money(o.tax)}</span></div>
        <div class="grand"><span>Total</span><span>${money(o.total)}</span></div></div>
      <div class="grid-2" style="margin-top:16px">
        <dl class="kv">
          <div><dt>Customer</dt><dd>${o.customer?.name || 'Walk-in'}</dd></div>
          ${o.customer?.phone ? html`<div><dt>Phone</dt><dd><a href="tel:${o.customer.phone}">${o.customer.phone}</a></dd></div>` : ''}
          ${o.customer?.address ? html`<div><dt>Address</dt><dd>${o.customer.address}</dd></div>` : ''}
          <div><dt>Payment</dt><dd>${o.paymentMethod.toUpperCase()}${o.payment?.razorpayPaymentId ? html`<br /><small class="muted">${o.payment.razorpayPaymentId}</small>` : ''}</dd></div>
          <div><dt>Created</dt><dd>${fmtDateTime(o.createdAt)}</dd></div>
          ${o.createdBy ? html`<div><dt>By</dt><dd>${o.createdBy.displayName || o.createdBy.email}</dd></div>` : ''}
          ${o.notes ? html`<div><dt>Notes</dt><dd>${o.notes}</dd></div>` : ''}
          ${o.user ? html`<div><dt>Customer account</dt><dd>${o.user.email || ''}${o.user.dob ? html`<br /><small class="muted">Age ${age(o.user.dob)}${o.user.gender ? ` · ${o.user.gender}` : ''}</small>` : ''}</dd></div>` : ''}
          ${o.user?.healthConditions?.length || o.user?.healthNotes ? html`<div><dt>Health</dt><dd>${[...(o.user.healthConditions || []), o.user.healthNotes].filter(Boolean).join(', ')}</dd></div>` : ''}
          ${o.prescriptionImage
            ? html`<div><dt>Prescription</dt><dd>${o.prescriptionImage.startsWith('/api/images/') ? html`<a href="${o.prescriptionImage}" target="_blank" rel="noopener">View photo</a>` : html`<button type="button" class="b b--sm" data-rx="${o.prescriptionImage}">View photo</button>`}</dd></div>`
            : ''}
        </dl>
        <div><strong style="font-size:.85rem">History</strong><ul class="timeline" style="margin-top:8px">${o.history.map(
          (h) => html`<li>${label(h.status)}<small>${fmtDateTime(h.at)}${h.by ? ` · ${h.by.displayName || h.by.email}` : ''}</small></li>`
        )}</ul></div>
      </div>
      ${final
        ? ''
        : html`<div class="panel" style="margin-top:16px"><div class="panel__head"><h3 class="panel__title">Update status</h3></div>
          <div class="chips" style="flex-wrap:wrap;margin:0">${STATUSES.filter((s) => s !== o.status && s !== 'awaiting-payment' && (o.status !== 'awaiting-payment' || s === 'cancelled')).map(
            (s) => html`<button type="button" class="chip" data-status="${s}" ${raw(s === 'cancelled' ? 'style="color:var(--danger)"' : '')}>${label(s)}</button>`
          )}</div>
          ${o.paymentStatus !== 'paid' ? html`<button type="button" class="b b--sm" data-paid style="margin-top:10px">Mark payment received</button>` : ''}</div>`}`);
  };

  const printBtn = button('Print invoice', { iconName: 'print', onClick: () => o && printHTML(invoiceHTML(o)) });
  const close = button('Close', { onClick: () => m.close() });
  const foot = el('<div class="modal__foot"></div>');
  foot.append(printBtn, close);
  m.root.querySelector('.modal__box').append(foot);

  m.body.addEventListener('click', async (e) => {
    const rxBtn = e.target.closest('[data-rx]');
    if (rxBtn) return openPrivateImage(rxBtn.dataset.rx);
    const st = e.target.closest('[data-status]');
    if (st) {
      const s = st.dataset.status;
      if (s === 'cancelled' && !(await confirmDialog('Cancel this order? A paid order will be marked refunded.', { okText: 'Cancel order', danger: true }))) return;
      try {
        await api(`/orders/${id}/status`, { method: 'PATCH', body: { status: s } });
        toast(`Order marked ${label(s)}`, 'success');
        onChange?.();
        draw();
      } catch (err) {
        toastError(err);
      }
    }
    if (e.target.closest('[data-paid]')) {
      try {
        await api(`/orders/${id}/payment`, { method: 'PATCH', body: { paymentStatus: 'paid' } });
        toast('Payment recorded', 'success');
        onChange?.();
        draw();
      } catch (err) {
        toastError(err);
      }
    }
  });
  draw();
}

/* ---------------- Orders page ---------------- */
export default async function orders(view, params) {
  const state = { status: params.status || '', q: '', from: '', to: '', page: 1 };
  setPage('Orders', [button('New order', { kind: 'primary', iconName: 'plus', onClick: () => newOrderDialog(load) })]);

  view.innerHTML = String(html`
    <div class="chips" data-chips>${CHIPS.map(([v, l]) => html`<button type="button" class="chip" data-chip="${v}">${l}</button>`)}</div>
    <div class="toolbar">
      <div class="search">${icon('search')}<input class="input" type="search" placeholder="Order no., customer name or phone" data-q /></div>
      <input class="input" type="date" data-from aria-label="From date" />
      <input class="input" type="date" data-to aria-label="To date" />
    </div>
    <div data-list>${skeleton()}</div>`);
  const listEl = $('[data-list]', view);
  const drawChips = () => $$('[data-chip]', view).forEach((c) => c.classList.toggle('is-active', c.dataset.chip === state.status));
  drawChips();

  $('[data-chips]', view).addEventListener('click', (e) => {
    const c = e.target.closest('[data-chip]');
    if (!c) return;
    state.status = c.dataset.chip;
    state.page = 1;
    drawChips();
    load();
  });
  $('[data-q]', view).addEventListener('input', debounce((e) => ((state.q = e.target.value.trim()), (state.page = 1), load())));
  $('[data-from]', view).addEventListener('change', (e) => ((state.from = e.target.value), (state.page = 1), load()));
  $('[data-to]', view).addEventListener('change', (e) => ((state.to = e.target.value), (state.page = 1), load()));

  let items = [];
  async function load() {
    try {
      const r = await api(`/orders?${qs(state)}`);
      items = r.items;
      if (!items.length) return (listEl.innerHTML = String(emptyState('No orders found', 'Create a sale with “New order”.')));
      listEl.innerHTML = String(html`
        <div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th class="num">Items</th><th class="num">Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>
          ${items.map(
            (o, i) => html`<tr class="is-clickable" tabindex="0" data-i="${i}">
              <td class="td-main" data-label="Order"><strong>${o.orderNo}</strong><br /><small class="muted">${fmtDateTime(o.createdAt)} · ${o.channel}</small></td>
              <td data-label="Customer">${o.customer?.name || 'Walk-in'}${o.customer?.phone ? html`<br /><small class="muted">${o.customer.phone}</small>` : ''}</td>
              <td class="num" data-label="Items">${num(o.items.reduce((s, i) => s + i.quantity, 0))}</td>
              <td class="num" data-label="Total"><strong>${money(o.total)}</strong></td>
              <td data-label="Payment">${badge(o.paymentStatus)}</td>
              <td data-label="Status">${badge(o.status)}</td>
            </tr>`
          )}</tbody></table></div>
        <div class="pager"><span>${num(r.total)} orders · ${money(r.amount)} (excl. cancelled)</span>
          ${r.pages > 1 ? html`<span><button class="b b--sm" data-pg="-1" ${raw(r.page <= 1 ? 'disabled' : '')}>Prev</button> <button class="b b--sm" data-pg="1" ${raw(r.page >= r.pages ? 'disabled' : '')}>Next</button></span>` : ''}</div>`);
    } catch (err) {
      listEl.innerHTML = String(emptyState('Could not load orders', err.message));
    }
  }
  listEl.addEventListener('click', (e) => {
    const pg = e.target.closest('[data-pg]');
    if (pg) return (state.page += Number(pg.dataset.pg)), load();
    const row = e.target.closest('tr[data-i]');
    if (row) orderDetail(items[row.dataset.i]._id, load);
  });
  listEl.addEventListener('keydown', (e) => {
    const row = e.target.closest('tr[data-i]');
    if (row && e.key === 'Enter') orderDetail(items[row.dataset.i]._id, load);
  });

  await load();
  if (params.new) newOrderDialog(load);
  if (params.open) orderDetail(params.open, load);
}
