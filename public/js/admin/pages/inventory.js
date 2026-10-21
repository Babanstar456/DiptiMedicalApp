import {
  $, html, el, raw, api, money, num, fmtDate, fmtDateTime, badge, setPage, button, modal, renderFields, readFields,
  validateFields, withLoading, toast, toastError, skeleton, emptyState, icon, debounce, qs, label,
} from '../core.js';

/* ---------------- Product search picker (shared with Orders) ---------------- */
export function productPicker(onPick, { placeholder = 'Search product by name, salt or barcode…', inStockOnly = false } = {}) {
  const box = el(html`<div class="picker"><div class="search">${icon('search')}<input class="input" type="search" placeholder="${placeholder}" autocomplete="off" /></div><div class="picker__list" hidden></div></div>`);
  const input = $('input', box);
  const list = $('.picker__list', box);
  let results = [];

  const search = debounce(async () => {
    const q = input.value.trim();
    if (!q) return (list.hidden = true);
    try {
      ({ items: results } = await api(`/products?${qs({ q, isActive: true, limit: 8 })}`));
      list.innerHTML = results.length
        ? String(html`${results.map(
            (p, i) => html`<button type="button" class="picker__opt" data-i="${i}" ${raw(inStockOnly && p.stock <= 0 ? 'disabled' : '')}>
              <div><strong>${p.name}</strong><small>${[p.composition, p.packSize].filter(Boolean).join(' · ')}</small></div>
              <div class="end">${money(p.price)}<br /><small class="${p.stock <= p.reorderLevel ? 'muted' : ''}">${p.stock <= 0 ? 'Out of stock' : `${num(p.stock)} in stock`}</small></div>
            </button>`
          )}`)
        : '<div class="empty" style="padding:16px">No products found</div>';
      list.hidden = false;
    } catch (err) {
      toastError(err);
    }
  }, 250);

  input.addEventListener('input', search);
  input.addEventListener('focus', () => input.value && search());
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

/* ---------------- Stock in / out dialog ---------------- */
const TYPES = [
  { value: 'purchase', label: 'Purchase / stock in (+)' },
  { value: 'return', label: 'Customer return (+)' },
  { value: 'damage', label: 'Damaged (−)' },
  { value: 'expired', label: 'Expired, removed (−)' },
  { value: 'adjustment', label: 'Manual correction (+/−)' },
];

export function stockDialog(product, onDone) {
  let chosen = product || null;
  const head = el('<div style="margin-bottom:14px"></div>');
  const drawChosen = () => {
    head.innerHTML = chosen
      ? String(html`<div class="panel" style="padding:12px 14px;display:flex;justify-content:space-between;gap:12px;align-items:center">
          <div><strong>${chosen.name}</strong><br /><small class="muted">Current stock: ${num(chosen.stock)}${chosen.batchNo ? ` · Batch ${chosen.batchNo}` : ''}</small></div>
          ${product ? '' : html`<button type="button" class="b b--sm" data-change>Change</button>`}</div>`)
      : '';
    if (!chosen) head.append(productPicker((p) => ((chosen = p), drawChosen())));
  };
  head.addEventListener('click', (e) => e.target.closest('[data-change]') && ((chosen = null), drawChosen()));
  drawChosen();

  const fields = [
    { name: 'type', label: 'Movement', type: 'select', options: TYPES, required: true, default: 'purchase' },
    { name: 'direction', label: 'Correction', type: 'select', options: [{ value: 'add', label: 'Add to stock' }, { value: 'remove', label: 'Remove from stock' }], required: true, half: true, default: 'add' },
    { name: 'quantity', label: 'Quantity', type: 'number', min: 1, step: 1, required: true, half: true },
    { name: 'batchNo', label: 'Batch no.', half: true },
    { name: 'expiryDate', label: 'Expiry date', type: 'date', half: true },
    { name: 'unitCost', label: 'Cost per unit (₹)', type: 'money', half: true },
    { name: 'supplier', label: 'Supplier', half: true },
    { name: 'reference', label: 'Invoice / reference no.', half: true },
    { name: 'note', label: 'Note', half: true },
  ];
  const form = renderFields(fields, {});
  const body = el('<div></div>');
  body.append(head, form);

  const syncType = () => {
    const t = $('[name="type"]', form).value;
    $('[data-name="direction"]', form).hidden = t !== 'adjustment';
    for (const n of ['batchNo', 'expiryDate', 'unitCost', 'supplier']) $(`[data-name="${n}"]`, form).hidden = t !== 'purchase';
  };
  $('[name="type"]', form).addEventListener('change', syncType);
  syncType();

  const save = button('Save movement', { kind: 'primary' });
  const cancel = button('Cancel');
  const m = modal({ title: 'Stock in / out', body, footer: [cancel, save] });
  cancel.addEventListener('click', m.close);
  save.addEventListener('click', () =>
    withLoading(save, async () => {
      if (!chosen) return toast('Choose a product first', 'error');
      if (!validateFields(form, fields)) return;
      try {
        const { product: p } = await api('/inventory/adjust', { method: 'POST', body: { product: chosen._id, ...readFields(form, fields) } });
        toast(`Stock updated · ${p.name}: ${num(p.stock)}`, 'success');
        m.close();
        onDone?.();
      } catch (err) {
        toastError(err);
      }
    })
  );
}

/* ---------------- Inventory page ---------------- */
const TABS = [
  ['alerts', 'Low stock'],
  ['expiring', 'Expiring / expired'],
  ['movements', 'Stock history'],
];

export default async function inventory(view, params) {
  let tab = TABS.some(([t]) => t === params.tab) ? params.tab : 'alerts';
  const reload = () => draw();
  setPage('Inventory', [button('Stock in/out', { kind: 'primary', iconName: 'plus', onClick: () => stockDialog(null, reload) })]);

  view.innerHTML = String(html`
    <div class="tiles" data-summary>${raw('<div class="skeleton" style="height:84px"></div>'.repeat(4))}</div>
    <div class="tabs-line" role="tablist">${TABS.map(([t, l]) => html`<button type="button" role="tab" data-tab="${t}">${l}</button>`)}</div>
    <div data-body></div>`);
  const bodyEl = $('[data-body]', view);

  view.querySelector('.tabs-line').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) {
      tab = b.dataset.tab;
      draw();
    }
  });

  async function summary() {
    try {
      const s = await api('/inventory/summary');
      $('[data-summary]', view).innerHTML = String(html`
        <div class="tile"><div class="tile__label">Active products</div><div class="tile__value">${num(s.products)}</div><div class="tile__meta">${num(s.units)} units in stock</div></div>
        <div class="tile"><div class="tile__label">Stock value (cost)</div><div class="tile__value">${money(s.costValue)}</div></div>
        <div class="tile"><div class="tile__label">Stock value (selling)</div><div class="tile__value">${money(s.saleValue)}</div></div>
        <div class="tile ${s.outOfStock ? 'tile--alert' : ''}"><div class="tile__label">Out of stock</div><div class="tile__value">${num(s.outOfStock)}</div></div>`);
    } catch (err) {
      toastError(err);
    }
  }

  const productTable = (rows, cols) =>
    rows.length
      ? html`<div class="table-wrap"><table class="table"><thead><tr>${cols.map((c) => html`<th class="${c.num ? 'num' : ''}">${c.label}</th>`)}</tr></thead>
          <tbody>${rows.map((p) => html`<tr>${cols.map((c) => html`<td class="${c.num ? 'num' : ''} ${c.main ? 'td-main' : ''}" data-label="${c.label}">${c.render(p)}</td>`)}</tr>`)}</tbody></table></div>`
      : emptyState('All good here', 'Nothing needs attention.');

  const restock = { label: '', render: (p) => html`<button type="button" class="b b--sm" data-restock="${p._id}">Stock in</button>` };
  let cache = {};

  async function draw() {
    view.querySelectorAll('[data-tab]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.tab === tab);
      b.setAttribute('aria-selected', b.dataset.tab === tab);
    });
    bodyEl.innerHTML = String(skeleton(4));
    summary();
    try {
      if (tab === 'movements') return drawMovements(1);
      const a = await api('/inventory/alerts');
      cache = Object.fromEntries([...a.lowStock, ...a.expiring, ...a.expired].map((p) => [p._id, p]));
      if (tab === 'alerts') {
        bodyEl.innerHTML = String(productTable(a.lowStock, [
          { label: 'Product', main: true, render: (p) => html`<strong>${p.name}</strong><br /><small class="muted">${p.rackLocation ? `Rack ${p.rackLocation}` : p.sku || ''}</small>` },
          { label: 'In stock', num: true, render: (p) => (p.stock <= 0 ? badge('out', 'Out of stock') : badge('low', num(p.stock))) },
          { label: 'Reorder level', num: true, render: (p) => num(p.reorderLevel) },
          restock,
        ]));
      } else {
        const rows = [...a.expired.map((p) => ({ ...p, _expired: true })), ...a.expiring];
        bodyEl.innerHTML = String(html`<p class="muted" style="margin:0 0 10px">Products with stock that expire within ${a.days} days, plus already expired stock.</p>
          ${productTable(rows, [
            { label: 'Product', main: true, render: (p) => html`<strong>${p.name}</strong><br /><small class="muted">${p.batchNo ? `Batch ${p.batchNo}` : ''}</small>` },
            { label: 'Expiry', render: (p) => badge(p._expired ? 'expired' : 'low', `${p._expired ? 'Expired' : 'Expires'} ${fmtDate(p.expiryDate)}`) },
            { label: 'In stock', num: true, render: (p) => num(p.stock) },
            { label: '', render: (p) => html`<button type="button" class="b b--sm b--danger" data-writeoff="${p._id}">Write off</button>` },
          ])}`);
      }
    } catch (err) {
      bodyEl.innerHTML = String(emptyState('Could not load', err.message));
    }
  }

  async function drawMovements(page) {
    const r = await api(`/inventory/movements?${qs({ page, limit: 30 })}`);
    if (!r.items.length) return (bodyEl.innerHTML = String(emptyState('No stock movements yet')));
    bodyEl.innerHTML = String(html`<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Product</th><th>Type</th><th class="num">Qty</th><th class="num">Balance</th><th>Details</th></tr></thead><tbody>
      ${r.items.map(
        (m) => html`<tr>
          <td data-label="When">${fmtDateTime(m.createdAt)}</td>
          <td class="td-main" data-label="Product"><strong>${m.product?.name || 'Deleted product'}</strong></td>
          <td data-label="Type">${badge(m.quantity > 0 ? 'active' : 'low', label(m.type))}</td>
          <td class="num" data-label="Qty">${m.quantity > 0 ? '+' : ''}${num(m.quantity)}</td>
          <td class="num" data-label="Balance">${num(m.balanceAfter)}</td>
          <td data-label="Details"><small class="muted">${[m.reference, m.supplier, m.batchNo && `Batch ${m.batchNo}`, m.note, m.by?.displayName || m.by?.email].filter(Boolean).join(' · ') || '—'}</small></td>
        </tr>`
      )}</tbody></table></div>
      <div class="pager"><span>Page ${r.page} of ${r.pages}</span><span>
        <button class="b b--sm" data-mpg="${r.page - 1}" ${raw(r.page <= 1 ? 'disabled' : '')}>Prev</button>
        <button class="b b--sm" data-mpg="${r.page + 1}" ${raw(r.page >= r.pages ? 'disabled' : '')}>Next</button></span></div>`);
  }

  bodyEl.addEventListener('click', async (e) => {
    const pg = e.target.closest('[data-mpg]');
    if (pg) return drawMovements(Number(pg.dataset.mpg)).catch(toastError);
    const rs = e.target.closest('[data-restock]');
    if (rs) return stockDialog(cache[rs.dataset.restock], reload);
    const wo = e.target.closest('[data-writeoff]');
    if (wo) {
      const p = cache[wo.dataset.writeoff];
      stockDialog(p, reload);
      setTimeout(() => {
        const t = document.querySelector('.modal [name="type"]');
        if (t) {
          t.value = 'expired';
          t.dispatchEvent(new Event('change'));
          const q = document.querySelector('.modal [name="quantity"]');
          q.value = p.stock;
        }
      }, 0);
    }
  });

  await draw();
  if (params.adjust) stockDialog(null, reload);
}
