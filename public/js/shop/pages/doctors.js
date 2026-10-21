import { html, render, api, money, emptyState, icon } from '../lib.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const fmtDays = (d) => (!d?.length || d.length === 7 ? 'All days' : DAYS.filter((x) => d.includes(x)).join(', '));
export const initial = (name) => (name || '?').replace(/^dr\.?\s*/i, '')[0]?.toUpperCase();

export default async function doctors(view, { config }) {
  render(view, html`<div class="wrap"><div class="page-head"><h1 class="page-title">Book a doctor</h1></div><div class="dgrid">${[1, 2, 3].map(() => html`<div class="skel" style="height:150px;border-radius:18px"></div>`)}</div></div>`);
  const list = await api('/doctors');
  render(
    view,
    html`<div class="wrap">
      <div class="page-head"><div class="crumbs"><a href="#/">Home</a>›<span>Doctors</span></div><h1 class="page-title">Book a doctor</h1>
        <p class="muted" style="margin:6px 0 0">Choose a doctor and time. Pay a <strong>${money(config.consultTokenAmount)}</strong> token online to confirm; the rest of the fee is paid at the clinic.</p></div>
      ${list.length
        ? html`<div class="dgrid">${list.map(
            (d) => html`<div class="dcard">
              <div class="dcard__photo">${d.photo ? html`<img src="${d.photo}" alt="" />` : initial(d.name)}</div>
              <div style="min-width:0">
                <h3>${d.name}</h3>
                <p>${d.specialization || 'General physician'}${d.qualification ? ` · ${d.qualification}` : ''}</p>
                <p class="muted">${fmtDays(d.days)}</p>
                <div class="dcard__fee">Consultation fee <strong>${money(d.fee)}</strong></div>
                <a class="sbtn sbtn--primary sbtn--sm" href="#/doctor/${d._id}">Book appointment</a>
              </div></div>`
          )}</div>`
        : emptyState('Doctors coming soon', 'Call us to book an appointment.', html`<a class="sbtn sbtn--outline" href="tel:+91${config.phone}">${icon('phone')}Call ${config.phone}</a>`)}
    </div>`
  );
}
