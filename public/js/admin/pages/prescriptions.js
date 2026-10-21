import { html, resourcePage, fmtDateTime, badge, openPrivateImage } from '../core.js';

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'called', label: 'Called customer' },
  { value: 'ordered', label: 'Order placed' },
  { value: 'closed', label: 'Closed' },
];

// Customers' "Upload prescription" requests: call them back, then track the outcome.
export default resourcePage({
  title: 'Prescription requests',
  singular: 'Request',
  endpoint: '/prescriptions',
  canCreate: false,
  canDelete: false,
  searchPlaceholder: 'Search request no., name or phone',
  defaultFilters: { status: 'new' },
  filters: [{ name: 'status', label: 'All statuses', options: STATUSES }],
  emptyHint: 'Requests from the shop’s “Upload prescription” page appear here.',
  columns: [
    { label: 'Request', main: true, render: (r) => html`<strong>${r.requestNo}</strong> <small class="muted">${fmtDateTime(r.createdAt)}</small>` },
    { label: 'Customer', render: (r) => html`${r.name}<br /><a href="tel:${r.phone}">${r.phone}</a>` },
    { label: 'Notes', render: (r) => html`<small>${[r.address, r.notes].filter(Boolean).join(' · ') || '—'}</small>` },
    { label: 'Status', render: (r) => badge(r.status, STATUSES.find((s) => s.value === r.status)?.label) },
    { label: '', render: () => html`<button type="button" class="b b--sm" data-action="view">View photo</button>` },
  ],
  fields: [
    { name: 'status', label: 'Status', type: 'select', options: STATUSES, required: true },
    { name: 'staffNote', label: 'Staff note', type: 'textarea', hint: 'Only visible to staff' },
  ],
  onAction: (action, r) => action === 'view' && openPrivateImage(r.image),
});
