import { $, html, el, raw, api, resourcePage, loadOptions, money, fmtDate, fmtTime, badge, todayStr, qs, toastError } from '../core.js';
import { thumb } from './catalog.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const doctors = resourcePage({
  title: 'Doctors',
  singular: 'Doctor',
  endpoint: '/doctors',
  searchPlaceholder: 'Search name, speciality, phone',
  sort: 'name',
  filters: [{ name: 'isActive', label: 'All statuses', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }],
  columns: [
    { label: 'Doctor', main: true, render: (d) => html`<div class="cell-main">${thumb(d.photo, true)}<div><strong>${d.name}</strong><small>${[d.specialization, d.qualification].filter(Boolean).join(' · ')}</small></div></div>` },
    { label: 'Timings', render: (d) => html`${d.days?.length === 7 || !d.days?.length ? 'All days' : d.days.join(', ')}<br /><small class="muted">${fmtTime(d.startTime)} – ${fmtTime(d.endTime)} · ${d.slotMinutes} min slots</small>` },
    { label: 'Fee', num: true, render: (d) => money(d.fee) },
    { label: 'Status', render: (d) => badge(d.isActive ? 'active' : 'inactive') },
  ],
  fields: [
    { name: 'photo', label: 'Photo', type: 'image' },
    { name: 'name', label: 'Full name', required: true, placeholder: 'Dr. A. Sharma' },
    { name: 'specialization', label: 'Specialization', half: true, placeholder: 'General Physician' },
    { name: 'qualification', label: 'Qualification', half: true, placeholder: 'MBBS, MD' },
    { name: 'registrationNo', label: 'Registration no.', half: true },
    { name: 'fee', label: 'Consultation fee (₹)', type: 'money', half: true },
    { name: 'phone', label: 'Phone', type: 'tel', half: true },
    { name: 'email', label: 'Email', type: 'email', half: true },
    { type: 'section', label: 'Availability' },
    { name: 'days', label: 'Days available', type: 'days', default: DAYS.slice(0, 6) },
    { name: 'startTime', label: 'From', type: 'time', half: true, default: '10:00', required: true },
    { name: 'endTime', label: 'To', type: 'time', half: true, default: '13:00', required: true },
    { name: 'slotMinutes', label: 'Slot length (minutes)', type: 'number', min: 5, max: 120, half: true, default: 15 },
    { name: 'isActive', label: 'Accepting appointments', type: 'switch', half: true, default: true },
    { name: 'bio', label: 'About', type: 'textarea' },
  ],
});

const doctorOptions = () => loadOptions('/doctors?limit=200&isActive=true&sort=name', (d) => `${d.name}${d.specialization ? ` · ${d.specialization}` : ''}`);
const STATUSES = ['awaiting-payment', 'pending', 'confirmed', 'completed', 'cancelled', 'no-show'];

// Shows the doctor's free slots for the chosen date; clicking one fills the time field.
function wireSlots(form, item) {
  const doctorSel = $('[name="doctor"]', form);
  const dateIn = $('[name="date"]', form);
  const timeIn = $('[name="time"]', form);
  const box = el('<div class="slots" aria-label="Available slots"></div>');
  $('[data-name="time"]', form).append(box);

  async function refresh() {
    box.innerHTML = '';
    if (!doctorSel.value || !dateIn.value) return;
    try {
      const r = await api(`/appointment-slots?${qs({ doctor: doctorSel.value, date: dateIn.value })}`);
      if (!r.worksToday) return (box.innerHTML = String(html`<span class="muted">Doctor is not available on ${r.day}.</span>`));
      if (!r.slots.length) return (box.innerHTML = '<span class="muted">No slots configured.</span>');
      box.innerHTML = String(html`${r.slots.map((s) => {
        const mine = item && item.time === s.time && item.date === dateIn.value && item.doctor?._id === doctorSel.value;
        return html`<button type="button" class="slot ${timeIn.value === s.time ? 'is-active' : ''}" data-slot="${s.time}" ${raw(s.booked && !mine ? 'disabled title="Booked"' : '')}>${fmtTime(s.time)}</button>`;
      })}`);
    } catch (err) {
      toastError(err);
    }
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot]');
    if (!b) return;
    timeIn.value = b.dataset.slot;
    box.querySelectorAll('.slot').forEach((s) => s.classList.toggle('is-active', s === b));
  });
  doctorSel.addEventListener('change', refresh);
  dateIn.addEventListener('change', refresh);
  // Doctor options load asynchronously; refresh once they are in.
  let tries = 0;
  const wait = setInterval(() => {
    if (!doctorSel.disabled || ++tries > 40) {
      clearInterval(wait);
      refresh();
    }
  }, 150);
}

export const appointments = resourcePage({
  title: 'Appointments',
  singular: 'Appointment',
  endpoint: '/appointments',
  searchPlaceholder: 'Patient name, phone or appointment no.',
  sort: 'date time',
  defaultFilters: { date: todayStr() },
  filters: [
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'doctor', label: 'All doctors', options: doctorOptions },
    { name: 'status', label: 'All statuses', options: STATUSES },
  ],
  emptyHint: 'Clear the date filter to see all appointments.',
  columns: [
    { label: 'When', main: true, render: (a) => html`<strong>${fmtTime(a.time)}</strong> <small class="muted">${fmtDate(a.date)} · ${a.appointmentNo}</small>` },
    { label: 'Patient', render: (a) => html`${a.patientName}<br /><small class="muted"><a href="tel:${a.patientPhone}">${a.patientPhone}</a>${a.patientAge ? ` · ${a.patientAge}y` : ''}</small>` },
    { label: 'Doctor', render: (a) => a.doctor?.name || '—' },
    { label: 'Fee', num: true, render: (a) => html`${money(a.fee)}<br />${badge(a.paymentStatus)}${a.channel === 'online' ? html` <span class="badge badge--info">Online</span>` : ''}` },
    { label: 'Status', render: (a) => badge(a.status) },
  ],
  fields: [
    { name: 'doctor', label: 'Doctor', type: 'select', options: doctorOptions, required: true },
    { name: 'date', label: 'Date', type: 'date', required: true, half: true, default: todayStr() },
    { name: 'time', label: 'Time', type: 'time', required: true, half: true, hint: 'Pick a free slot below or type a time' },
    { type: 'section', label: 'Patient' },
    { name: 'patientName', label: 'Patient name', required: true, half: true },
    { name: 'patientPhone', label: 'Phone', type: 'tel', required: true, half: true },
    { name: 'patientAge', label: 'Age', type: 'number', min: 0, max: 130, half: true },
    { name: 'patientGender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], half: true },
    { name: 'reason', label: 'Reason for visit', type: 'textarea' },
    { type: 'section', label: 'Status & payment' },
    { name: 'status', label: 'Status', type: 'select', options: STATUSES, required: true, half: true, default: 'confirmed' },
    { name: 'paymentStatus', label: 'Payment', type: 'select', options: [{ value: 'unpaid', label: 'Unpaid' }, { value: 'token-paid', label: 'Token paid online' }, { value: 'paid', label: 'Fully paid' }, { value: 'refunded', label: 'Refunded' }], required: true, half: true, default: 'unpaid' },
    { name: 'fee', label: 'Fee (₹)', type: 'money', half: true, hint: 'Leave empty to use the doctor’s fee' },
    { name: 'notes', label: 'Doctor / desk notes', type: 'textarea' },
  ],
  toForm: (a) => ({ ...a, doctor: a.doctor?._id }),
  afterRender: wireSlots,
});
