import { $, html, el, api, resourcePage, loadOptions, clearOptionCache, money, badge, button, modal, toast, toastError, confirmDialog, skeleton, emptyState } from '../core.js';

export const thumb = (src, round = false) =>
  src ? html`<img class="thumb ${round ? 'thumb--round' : ''}" src="${src}" alt="" loading="lazy" />` : html`<span class="thumb ${round ? 'thumb--round' : ''}"></span>`;

const categoryOptions = () => loadOptions('/categories?limit=200&sort=sortOrder name');
const typeOptions = () => loadOptions('/types?limit=200&sort=name');
const GST = [0, 5, 12, 18, 28].map((v) => ({ value: v, label: `${v}%` }));

const stockButton = (p) =>
  html`<button type="button" class="badge ${p.inStock ? 'badge--ok' : 'badge--bad'}" data-action="toggle" title="Tap to change" style="border:0;cursor:pointer">${p.inStock ? 'In stock' : 'Out of stock'}</button>`;

/* ---------------- Categories & types (rename / delete / add) ---------------- */
function manageDialog(onChange) {
  const body = el(`<div>${skeleton(3)}</div>`);
  const m = modal({ title: 'Categories & types', body, wide: true, onClose: onChange });

  const section = (kind, title, singular, items) => html`
    <section class="panel" data-kind="${kind}">
      <div class="panel__head"><h3 class="panel__title">${title}</h3></div>
      <form class="toolbar" data-add style="margin-bottom:10px"><input class="input" name="name" placeholder="Add new ${singular}" maxlength="80" style="flex:1" /><button class="b b--primary b--sm">Add</button></form>
      ${items.length
        ? html`<div class="list">${items.map(
            (x) => html`<div class="list__item" data-id="${x._id}"><input class="input" value="${x.name}" data-rename style="flex:1;min-height:38px" aria-label="Name" /><button type="button" class="b b--sm b--danger" data-delete>Delete</button></div>`
          )}</div>`
        : emptyState('None yet')}
    </section>`;

  async function draw() {
    try {
      const [c, t] = await Promise.all([api('/categories?limit=200&sort=sortOrder name'), api('/types?limit=200&sort=name')]);
      body.innerHTML = String(html`<p class="muted" style="margin:0 0 12px">Typing a new name in a product form also creates it. Edit a name here and press Enter to rename it for every product.</p>
        ${section('categories', 'Categories', 'category', c.items)}${section('types', 'Types', 'type', t.items)}`);
    } catch (err) {
      body.innerHTML = String(emptyState('Could not load', err.message));
    }
  }

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kind = e.target.closest('[data-kind]').dataset.kind;
    const name = e.target.name.value.trim();
    if (!name) return;
    try {
      await api(`/${kind}`, { method: 'POST', body: { name } });
      clearOptionCache();
      draw();
    } catch (err) {
      toastError(err);
    }
  });
  body.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-rename]')) return;
    const kind = e.target.closest('[data-kind]').dataset.kind;
    const id = e.target.closest('[data-id]').dataset.id;
    try {
      await api(`/${kind}/${id}`, { method: 'PUT', body: { name: e.target.value.trim() } });
      clearOptionCache();
      toast('Renamed', 'success');
    } catch (err) {
      toastError(err);
      draw();
    }
  });
  body.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-delete]')) return;
    const kind = e.target.closest('[data-kind]').dataset.kind;
    const id = e.target.closest('[data-id]').dataset.id;
    if (!(await confirmDialog('Delete this entry?', { okText: 'Delete', danger: true }))) return;
    try {
      await api(`/${kind}/${id}`, { method: 'DELETE' });
      clearOptionCache();
      draw();
    } catch (err) {
      toastError(err);
    }
  });
  draw();
  return m;
}

/* ---------------- Products ---------------- */
export const products = resourcePage({
  title: 'Products',
  singular: 'Product',
  endpoint: '/products',
  searchPlaceholder: 'Search name, salt, company, barcode…',
  sort: 'name',
  wideForm: true,
  filters: [
    { name: 'inStock', label: 'In & out of stock', options: [{ value: 'true', label: 'In stock' }, { value: 'false', label: 'Out of stock' }] },
    { name: 'category', label: 'All categories', options: categoryOptions },
    { name: 'type', label: 'All types', options: typeOptions },
    { name: 'price', label: 'Any price', options: [{ value: 'missing', label: 'Price not set' }] },
    { name: 'isActive', label: 'Active & hidden', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Hidden' }] },
  ],
  columns: [
    {
      label: 'Product',
      main: true,
      render: (p) => html`<div class="cell-main">${thumb(p.images?.[0])}<div><strong>${p.name}${p.prescriptionRequired ? html` <span class="badge badge--info">Rx</span>` : ''}${p.isActive ? '' : html` ${badge('inactive', 'Hidden')}`}</strong><small>${[p.manufacturer, p.composition].filter(Boolean).join(' · ')}</small></div></div>`,
    },
    { label: 'Category', render: (p) => html`${p.category?.name || '—'}${p.type ? html`<br /><small class="muted">${p.type.name}</small>` : ''}` },
    { label: 'Rack', render: (p) => p.rackLocation || '—' },
    { label: 'Price', num: true, render: (p) => (p.price > 0 ? html`${money(p.price)}${p.mrp > p.price ? html`<br /><small class="muted"><s>${money(p.mrp)}</s></small>` : ''}` : badge('low', 'Not set')) },
    { label: 'Stock', render: stockButton },
  ],
  fields: [
    { name: 'name', label: 'Product name', required: true, maxlength: 150, placeholder: 'CALPOL 650MG 15TAB' },
    { name: 'categoryName', label: 'Category', type: 'combo', options: categoryOptions, half: true, placeholder: 'Pick or type a new one' },
    { name: 'typeName', label: 'Type', type: 'combo', options: typeOptions, half: true, placeholder: 'Tablet, Syrup… or type new' },
    { name: 'price', label: 'Selling price (₹)', type: 'money', half: true },
    { name: 'mrp', label: 'MRP (₹)', type: 'money', half: true },
    { name: 'inStock', label: 'In stock', type: 'switch', half: true, default: true },
    { name: 'prescriptionRequired', label: 'Prescription required (Rx)', type: 'switch', half: true },
    { name: 'featured', label: 'Show in shop Bestsellers', type: 'switch', half: true },
    { type: 'section', label: 'More details (optional)' },
    { name: 'manufacturer', label: 'Company', half: true },
    { name: 'composition', label: 'Salt / composition', half: true },
    { name: 'strength', label: 'Strength', half: true, placeholder: '650 mg' },
    { name: 'packSize', label: 'Pack size', half: true, placeholder: '15 tablets' },
    { name: 'rackLocation', label: 'Rack', half: true },
    { name: 'supplier', label: 'Supplier', half: true },
    { name: 'gstRate', label: 'GST', type: 'select', options: GST, required: true, half: true, default: 12 },
    { name: 'barcode', label: 'Barcode', half: true },
    { name: 'images', label: 'Photos', type: 'images' },
    { name: 'description', label: 'Description', type: 'textarea', maxlength: 2000 },
    { name: 'isActive', label: 'Active (show for sale)', type: 'switch', default: true },
  ],
  toForm: (p) => ({ ...p, categoryName: p.category?.name || '', typeName: p.type?.name || '' }),
  actions: (reload) => [button('Categories & types', { iconName: 'tag', title: 'Categories & types', onClick: () => manageDialog(reload) })],
  onAction: async (action, p, reload) => {
    if (action !== 'toggle') return;
    try {
      await api(`/products/${p._id}`, { method: 'PUT', body: { inStock: !p.inStock } });
      toast(`${p.name}: ${p.inStock ? 'out of stock' : 'in stock'}`, 'success');
      reload();
    } catch (err) {
      toastError(err);
    }
  },
});
