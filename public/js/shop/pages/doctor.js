import { $, $$, html, render, api, auth, icon, money, fmtTime, fmtDate, todayIST, loginUrl, pay, toast, withLoading } from '../lib.js';
import { fmtDays, initial } from './doctors.js';

const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function doctorPage(view, { args, config }) {
  const doctors = await api('/doctors');
  const d = doctors.find((x) => x._id === args[0]);
  if (!d) {
    render(view, html`<div class="wrap empty-state"><strong>Doctor not found</strong><a class="sbtn sbtn--primary" href="#/doctors">See all doctors</a></div>`);
    return;
  }
  const today = todayIST();
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i)).filter((x) => !d.days?.length || d.days.includes(DAY[new Date(`${x}T00:00:00Z`).getUTCDay()]));
  let date = dates[0];
  let time = '';
  const profile = (await auth.ready) ? (await api('/my/me', { auth: true }).catch(() => ({}))).user || auth.profile : null;

  render(
    view,
    html`<div class="wrap" style="max-width:860px">
      <div class="page-head"><div class="crumbs"><a href="#/doctors">Doctors</a>›<span>${d.name}</span></div></div>
      <div class="dcard" style="margin-bottom:16px">
        <div class="dcard__photo">${d.photo ? html`<img src="${d.photo}" alt="" />` : initial(d.name)}</div>
        <div><h1 style="margin:0;font-size:1.25rem">${d.name}</h1><p>${d.specialization || 'General physician'}${d.qualification ? ` · ${d.qualification}` : ''}</p>
          <p class="muted">${fmtDays(d.days)} · ${fmtTime(d.startTime)} – ${fmtTime(d.endTime)}</p>
          <div class="dcard__fee">Fee <strong>${money(d.fee)}</strong> · Pay <strong>${money(config.consultTokenAmount)}</strong> now to book</div></div>
      </div>
      ${d.bio ? html`<p class="prose">${d.bio}</p>` : ''}

      <section class="scard">
        <h2 class="scard__title"><span class="step">1</span>Choose a date</h2>
        ${dates.length ? html`<div class="datebar">${dates.map(
          (x, i) => html`<button type="button" class="${i ? '' : 'is-active'}" data-date="${x}"><small>${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY[new Date(`${x}T00:00:00Z`).getUTCDay()]}</small><strong>${Number(x.slice(8))}</strong><small>${new Date(`${x}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</small></button>`
        )}</div>` : html`<p class="muted">No dates available in the next 2 weeks. Please call ${config.phone}.</p>`}
      </section>
      <section class="scard"><h2 class="scard__title"><span class="step">2</span>Choose a time</h2><div data-slots></div></section>
      <section class="scard">
        <h2 class="scard__title"><span class="step">3</span>Patient details</h2>
        <div class="form-grid">
          <div class="sfield"><label for="p_name">Patient name</label><input class="sinput" id="p_name" required autocomplete="name" value="${profile?.displayName || ''}" /></div>
          <div class="sfield"><label for="p_phone">Mobile number</label><input class="sinput" id="p_phone" type="tel" inputmode="tel" required maxlength="13" autocomplete="tel" value="${profile?.phoneNumber || ''}" /></div>
          <div class="sfield"><label for="p_age">Age</label><input class="sinput" id="p_age" type="number" inputmode="numeric" min="0" max="120" value="${profile?.age ?? ''}" /></div>
          <div class="sfield"><label for="p_gender">Gender</label><select class="sselect sinput" id="p_gender"><option value="">Prefer not to say</option><option>Male</option><option>Female</option><option>Other</option></select></div>
          <div class="sfield full"><label for="p_reason">Reason for visit (optional)</label><textarea class="stextarea" id="p_reason" maxlength="500"></textarea></div>
        </div>
        <p class="form-error" data-error hidden></p>
        <button class="sbtn sbtn--primary sbtn--block sbtn--lg" type="button" data-book style="margin-top:14px" ${dates.length ? '' : 'disabled'}>${icon('lock')}Pay ${money(config.consultTokenAmount)} & book</button>
        <p class="muted" style="font-size:.76rem;text-align:center;margin:8px 0 0">Remaining ${money(Math.max(0, d.fee - config.consultTokenAmount))} is paid at the clinic.</p>
      </section>
    </div>`
  );

  if (profile?.gender) $('#p_gender', view).value = profile.gender;
  const slotsEl = $('[data-slots]', view);
  async function loadSlots() {
    time = '';
    if (!date) return;
    render(slotsEl, html`<div class="slotgrid">${Array.from({ length: 6 }, () => html`<div class="skel" style="height:42px"></div>`)}</div>`);
    try {
      const r = await api(`/doctors/${d._id}/slots?date=${date}`);
      const free = r.slots.filter((s) => !s.booked);
      render(
        slotsEl,
        !r.worksToday || !r.slots.length
          ? html`<p class="muted">The doctor is not available on this day.</p>`
          : html`<div class="slotgrid">${r.slots.map((s) => html`<button type="button" data-time="${s.time}" ${s.booked ? 'disabled' : ''}>${fmtTime(s.time)}</button>`)}</div>${free.length ? '' : html`<p class="muted" style="margin:10px 0 0">All slots are taken for ${fmtDate(date)}. Please choose another day.</p>`}`
      );
    } catch (err) {
      render(slotsEl, html`<p class="form-error">${err.message}</p>`);
    }
  }
  view.addEventListener('click', (e) => {
    const dBtn = e.target.closest('[data-date]');
    if (dBtn) {
      date = dBtn.dataset.date;
      $$('[data-date]', view).forEach((b) => b.classList.toggle('is-active', b === dBtn));
      loadSlots();
    }
    const tBtn = e.target.closest('[data-time]');
    if (tBtn) {
      time = tBtn.dataset.time;
      $$('[data-time]', view).forEach((b) => b.classList.toggle('is-active', b === tBtn));
    }
  });
  loadSlots();

  const errorEl = $('[data-error]', view);
  $('[data-book]', view).addEventListener('click', (e) =>
    withLoading(e.currentTarget, async () => {
      errorEl.hidden = true;
      const fail = (m) => ((errorEl.textContent = m), (errorEl.hidden = false), toast(m, 'error'));
      if (!(await auth.ready)) return (location.href = loginUrl(`#/doctor/${d._id}`));
      if (!time) return fail('Please choose a time slot.');
      const name = $('#p_name', view);
      const phone = $('#p_phone', view);
      if (!name.value.trim()) return name.focus(), fail('Enter the patient name.');
      if (!/^[6-9]\d{9}$/.test(phone.value.replace(/\D/g, '').slice(-10))) return phone.focus(), fail('Enter a valid 10-digit mobile number.');
      try {
        const res = await api('/my/appointments', {
          method: 'POST',
          auth: true,
          body: { doctor: d._id, date, time, patientName: name.value, patientPhone: phone.value, patientAge: $('#p_age', view).value, patientGender: $('#p_gender', view).value, reason: $('#p_reason', view).value },
        });
        const result = await pay(res.payment);
        if (result) {
          toast('Appointment booked!', 'success');
          location.hash = '#/account/appointments?booked=1';
        } else {
          toast('Payment not completed. You can pay from My appointments within 15 minutes.', 'error');
          location.hash = '#/account/appointments';
        }
      } catch (err) {
        fail(err.message);
        if (err.status === 409) loadSlots();
      }
    })
  );
}
