import { html, el, resourcePage, loadOptions, money, num, fmtDate, badge, button } from '../core.js';
import { stockDialog } from './inventory.js';

const activeBadge = (x) => badge(x.isActive ? 'active' : 'inactive');
const thumb = (src, round = false) =>
  src ? html`<img class="thumb ${round ? 'thumb--round' : ''}" src="${src}" alt="" loading="lazy" />` : html`<span class="thumb ${round ? 'thumb--round' : ''}"></span>`;
export { thumb };

export const categories = resourcePage({
  title: 'Categories',
  singular: 'Category',
  endpoint: '/categories',
  searchPlaceholder: 'Search categories',
  sort: 'sortOrder name',
  filters: [{ name: 'isActive', label: 'All statuses', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }],
  emptyHint: 'e.g. Pain relief, Diabetes care, Baby care, Ayurveda',
  columns: [
    { label: 'Category', main: true, render: (c) => html`<div class="cell-main">${thumb(c.image)}<div><strong>${c.name}</strong><small>${c.description || ''}</small></div></div>` },
    { label: 'Order', num: true, render: (c) => c.sortOrder },
    { label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, maxlength: 80 },
    { name: 'description', label: 'Description', type: 'textarea', maxlength: 500 },
    { name: 'image', label: 'Image', type: 'image' },
    { name: 'sortOrder', label: 'Display order', type: 'number', half: true, default: 0, hint: 'Lower numbers show first' },
    { name: 'isActive', label: 'Active', type: 'switch', half: true, default: true },
  ],
});

export const types = resourcePage({
  title: 'Product types',
  singular: 'Type',
  endpoint: '/types',
  searchPlaceholder: 'Search types',
  sort: 'name',
  emptyHint: 'e.g. Tablet, Capsule, Syrup, Injection, Ointment, Drops, Device',
  columns: [
    { label: 'Type', main: true, render: (t) => html`<strong>${t.name}</strong>` },
    { label: 'Unit', render: (t) => t.unit },
    { label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, half: true, placeholder: 'Tablet' },
    { name: 'unit', label: 'Selling unit', half: true, placeholder: 'strip, bottle, tube, pcs', default: 'pcs' },
    { name: 'isActive', label: 'Active', type: 'switch', default: true },
  ],
});

const categoryOptions = () => loadOptions('/categories?limit=200&sort=sortOrder name');
const typeOptions = () => loadOptions('/types?limit=200&sort=name');
const GST = [0, 5, 12, 18, 28].map((v) => ({ value: v, label: `${v}%` }));

function stockBadge(p) {
  if (p.stock <= 0) return badge('out', 'Out of stock');
  if (p.stock <= p.reorderLevel) return badge('low', `${num(p.stock)} · low`);
  return html`${num(p.stock)}`;
}
function expiryCell(p) {
  if (!p.expiryDate) return '—';
  const days = (new Date(p.expiryDate) - Date.now()) / 86400000;
  if (days < 0) return badge('expired', `Expired ${fmtDate(p.expiryDate)}`);
  if (days <= 90) return badge('low', fmtDate(p.expiryDate));
  return fmtDate(p.expiryDate);
}

export const products = resourcePage({
  title: 'Products',
  singular: 'Product',
  endpoint: '/products',
  searchPlaceholder: 'Search name, salt, SKU, barcode…',
  sort: 'name',
  wideForm: true,
  filters: [
    { name: 'category', label: 'All categories', options: categoryOptions },
    { name: 'type', label: 'All types', options: typeOptions },
    { name: 'stock', label: 'Any stock', options: [{ value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }] },
    { name: 'isActive', label: 'All statuses', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
  ],
  columns: [
    {
      label: 'Product',
      main: true,
      render: (p) => html`<div class="cell-main">${thumb(p.images?.[0])}<div><strong>${p.name}${p.prescriptionRequired ? html` <span class="badge badge--info">Rx</span>` : ''}</strong><small>${[p.composition, p.strength, p.packSize].filter(Boolean).join(' · ')}</small></div></div>`,
    },
    { label: 'Category', render: (p) => html`${p.category?.name || '—'}${p.type ? html`<br /><small class="muted">${p.type.name}</small>` : ''}` },
    { label: 'Price', num: true, render: (p) => html`${money(p.price)}${p.mrp > p.price ? html`<br /><small class="muted"><s>${money(p.mrp)}</s></small>` : ''}` },
    { label: 'Stock', num: true, render: stockBadge },
    { label: 'Expiry', render: expiryCell },
    { label: 'Action', render: (p) => html`${p.isActive ? '' : badge('inactive')} <button type="button" class="b b--sm" data-action="stock">Stock</button>` },
  ],
  fields: (item) => [
    { type: 'section', label: 'Basic details' },
    { name: 'name', label: 'Product name', required: true, maxlength: 150, placeholder: 'Paracetamol 500mg' },
    { name: 'category', label: 'Category', type: 'select', options: categoryOptions, half: true },
    { name: 'type', label: 'Type', type: 'select', options: typeOptions, half: true },
    { name: 'composition', label: 'Composition / salt', half: true, placeholder: 'Paracetamol' },
    { name: 'manufacturer', label: 'Manufacturer', half: true },
    { name: 'strength', label: 'Strength', half: true, placeholder: '500 mg' },
    { name: 'packSize', label: 'Pack size', half: true, placeholder: '10 tablets' },
    { name: 'sku', label: 'SKU', half: true },
    { name: 'barcode', label: 'Barcode', half: true, type: 'text' },
    { type: 'section', label: 'Pricing' },
    { name: 'mrp', label: 'MRP (₹)', type: 'money', half: true },
    { name: 'price', label: 'Selling price (₹)', type: 'money', required: true, half: true },
    { name: 'costPrice', label: 'Purchase cost (₹)', type: 'money', half: true },
    { name: 'gstRate', label: 'GST', type: 'select', options: GST, required: true, half: true, default: 12 },
    { type: 'section', label: 'Stock' },
    ...(item
      ? [{ name: 'stockInfo', label: 'Current stock', type: 'custom', half: true, render: () => el(html`<div class="muted" style="padding:10px 0">${num(item.stock)} in stock · use “Stock in/out” to change</div>`) }]
      : [{ name: 'openingStock', label: 'Opening stock', type: 'number', min: 0, half: true, default: 0 }]),
    { name: 'reorderLevel', label: 'Reorder level', type: 'number', min: 0, half: true, default: 10, hint: 'Alert when stock falls to this' },
    { name: 'batchNo', label: 'Batch no.', half: true },
    { name: 'expiryDate', label: 'Expiry date', type: 'date', half: true },
    { name: 'rackLocation', label: 'Rack / shelf', half: true },
    { name: 'prescriptionRequired', label: 'Prescription required (Rx)', type: 'switch', half: true },
    { type: 'section', label: 'Images & description' },
    { name: 'images', label: 'Photos', type: 'images' },
    { name: 'description', label: 'Description', type: 'textarea', maxlength: 2000 },
    { name: 'isActive', label: 'Active (visible for sale)', type: 'switch', default: true },
  ],
  actions: (reload) => [button('Stock in/out', { iconName: 'refresh', title: 'Stock in / out', onClick: () => stockDialog(null, reload) })],
  onAction: (action, p, reload) => action === 'stock' && stockDialog(p, reload),
});
