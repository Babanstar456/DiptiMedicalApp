import {
  $, $$, html, render, api, auth, icon, money, titleCase, fmtDate, fmtTime, statusBadge, loginUrl, pay, toast, withLoading, emptyState,
  reorder, ageFrom, formatAddress, HEALTH_CONDITIONS, todayIST,
} from '../lib.js';

const TABS = [
  ['orders', 'Orders'],
  ['appointments', 'Appointments'],
  ['prescriptions', 'Prescriptions'],
  ['profile', 'Profile & addresses'],
];
const ACTIVE = ['pending', 'confirmed', 'packed', 'out-for-delivery'];
const FLOW = ['confirmed', 'packed', 'out-for-delivery', 'delivered'];
const ADDRESS_FIELDS = [
  ['name', 'Full name', 'name', true],
  ['phone', 'Mobile number', 'tel', true],
  ['line1', 'House / flat, street', 'address-line1', true],
  ['line2', 'Area / locality', 'address-line2', false],
  ['landmark', 'Landmark', 'off', false],
  ['city', 'City / town', 'address-level2', true],
  ['pincode', 'PIN code', 'postal-code', true],
];

const progress = (status) => {
  const step = FLOW.indexOf(status === 'pending' ? 'confirmed' : status);
  return html`<div class="steps" style="margin:12px 0 0">${['Confirmed', 'Packed', 'On the way', 'Delivered'].map((l, i) => html`<div class="${i <= step ? 'is-done' : ''}">${l}</div>`)}</div>`;
};

function orderCard(o, { showProgress = false } = {}) {
  return html`<div class="ocard">
    <a href="#/order/${o._id}" style="display:block">
      <div class="ocard__top"><div><strong>${o.orderNo}</strong><div class="ocard__meta">${fmtDate(o.createdAt)} · ${o.items.length} item${o.items.length === 1 ? '' : 's'}</div></div>${statusBadge(o.status)}</div>
      ${showProgress ? progress(o.status) : ''}
      <div class="ocard__bottom"><span class="muted">${o.items.slice(0, 2).map((i) => titleCase(i.name)).join(', ')}${o.items.length > 2 ? '…' : ''}</span><strong>${money(o.total)}</strong></div>
    </a>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${o.status === 'awaiting-payment' ? html`<a class="sbtn sbtn--primary sbtn--sm" href="#/order/${o._id}">Complete payment</a>` : ''}
      <button class="sbtn sbtn--outline sbtn--sm" type="button" data-reorder="${o._id}">${icon('cart')}Order again</button>
      <a class="sbtn sbtn--ghost sbtn--sm" href="#/order/${o._id}">Details</a>
    </div>
  </div>`;
}

export default async function account(view, { args, params }) {
  const user = await auth.ready;
  if (!user) {
    render(view, html`<div class="wrap empty-state" style="max-width:520px">${icon('pharmacist')}<strong>Sign in to your account</strong><p>See your orders, appointments and saved addresses. New here? Your account is created automatically.</p><a class="sbtn sbtn--primary sbtn--lg" href="${loginUrl('#/account')}">Login / Sign up</a></div>`);
    return;
  }
  const tab = TABS.some(([t]) => t === args[0]) ? args[0] : 'orders';
  let profile = (await api('/my/me', { auth: true })).user;
  auth.profile = profile;
  const name = profile.displayName || user.email?.split('@')[0];

  render(
    view,
    html`<div class="wrap" style="max-width:900px">
      <div class="page-head" style="padding-bottom:0"></div>
      <div class="profile-head"><img src="${profile.photoURL || '/img/logo-mark.png'}" alt="" /><div style="min-width:0;flex:1"><strong>Hi, ${titleCase(name)}</strong><small>${[profile.phoneNumber, user.email].filter(Boolean).join(' · ')}</small></div>
        ${['admin', 'pharmacist'].includes(profile.role) ? html`<a class="sbtn sbtn--sm" style="background:#fff;color:var(--brand-700)" href="/admin/">Admin panel</a>` : ''}</div>
      ${!profile.phoneNumber ? html`<a class="notice notice--info" href="#/account/profile">${icon('info')}<span>Add your mobile number and address to place orders faster.</span></a>` : ''}
      <nav class="otabs">${TABS.map(([t, l]) => html`<a href="#/account/${t}" class="${t === tab ? 'is-active' : ''}">${l}</a>`)}</nav>
      <div data-tab><div class="skel" style="height:120px"></div></div>
      <button class="sbtn sbtn--ghost" type="button" data-signout style="margin-top:20px">Sign out</button>
    </div>`
  );
  const box = $('[data-tab]', view);
  $('[data-signout]', view).addEventListener('click', async () => {
    await auth.signOut();
    toast('Signed out');
    location.hash = '#/';
  });

  /* ---------------- Orders: active ones with live status, then history; Order again everywhere ---------------- */
  if (tab === 'orders') {
    const orders = await api('/my/orders', { auth: true });
    const active = orders.filter((o) => ACTIVE.includes(o.status));
    const unpaid = orders.filter((o) => o.status === 'awaiting-payment');
    const past = orders.filter((o) => !ACTIVE.includes(o.status) && o.status !== 'awaiting-payment');
    render(
      box,
      orders.length
        ? html`
          ${unpaid.length ? html`<h2 class="section__title" style="font-size:1rem;margin:0 0 10px">Waiting for payment</h2><div class="olist" style="margin-bottom:20px">${unpaid.map((o) => orderCard(o))}</div>` : ''}
          ${active.length ? html`<h2 class="section__title" style="font-size:1rem;margin:0 0 10px">Current orders</h2><div class="olist" style="margin-bottom:20px">${active.map((o) => orderCard(o, { showProgress: true }))}</div>` : ''}
          ${past.length ? html`<h2 class="section__title" style="font-size:1rem;margin:0 0 10px">Past orders</h2><div class="olist">${past.map((o) => orderCard(o))}</div>` : ''}`
        : emptyState('No orders yet', 'Your orders will appear here.', html`<a class="sbtn sbtn--primary" href="#/">Start shopping</a>`)
    );
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-reorder]');
      if (!b) return;
      const order = orders.find((o) => o._id === b.dataset.reorder);
      withLoading(b, () => reorder(order).catch((err) => toast(err.message, 'error')));
    });
  }

  /* ---------------- Appointments ---------------- */
  if (tab === 'appointments') {
    const list = await api('/my/appointments', { auth: true });
    render(
      box,
      html`${params.booked ? html`<div class="notice notice--ok">${icon('check')}<span><strong>Your appointment is confirmed.</strong> Please arrive 10 minutes early.</span></div>` : ''}
      ${list.length
        ? html`<div class="olist">${list.map(
            (a) => html`<div class="ocard"><div class="ocard__top"><div><strong>${a.doctor?.name || 'Doctor'}</strong><div class="ocard__meta">${fmtDate(a.date)} · ${fmtTime(a.time)} · ${a.appointmentNo}</div></div>${statusBadge(a.status)}</div>
              <div class="ocard__bottom"><span class="muted">Patient: ${a.patientName}</span><span>${a.paymentStatus === 'token-paid' ? `Paid ${money(a.tokenAmount)} · ${money(Math.max(0, a.fee - a.tokenAmount))} at clinic` : a.paymentStatus === 'paid' ? 'Paid' : ''}</span></div>
              ${a.status === 'awaiting-payment' ? html`<div style="display:flex;gap:8px;margin-top:10px"><button class="sbtn sbtn--primary sbtn--sm" type="button" data-apay="${a._id}">Pay ${money(a.tokenAmount)}</button><button class="sbtn sbtn--ghost sbtn--sm" type="button" data-acancel="${a._id}">Cancel</button></div>` : ''}
            </div>`
          )}</div>`
        : emptyState('No appointments yet', 'Book a doctor in a few taps.', html`<a class="sbtn sbtn--primary" href="#/doctors">Book a doctor</a>`)}`
    );
    box.addEventListener('click', async (e) => {
      const p = e.target.closest('[data-apay]');
      const c = e.target.closest('[data-acancel]');
      if (p)
        withLoading(p, async () => {
          try {
            const res = await api(`/my/appointments/${p.dataset.apay}/pay`, { method: 'POST', auth: true });
            if (await pay(res.payment)) location.hash = `#/account/appointments?booked=1&t=${Date.now()}`;
          } catch (err) {
            toast(err.message, 'error');
          }
        });
      if (c && confirm('Cancel this booking?')) {
        try {
          await api(`/my/appointments/${c.dataset.acancel}/cancel`, { method: 'POST', auth: true });
          location.hash = `#/account/appointments?t=${Date.now()}`;
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    });
  }

  /* ---------------- Prescriptions ---------------- */
  if (tab === 'prescriptions') {
    const list = await api('/my/prescriptions', { auth: true });
    render(
      box,
      list.length
        ? html`<div class="olist">${list.map((r) => html`<div class="ocard"><div class="ocard__top"><div><strong>${r.requestNo}</strong><div class="ocard__meta">${fmtDate(r.createdAt)}${r.notes ? ` · ${r.notes}` : ''}</div></div>${statusBadge(r.status)}</div></div>`)}</div>`
        : emptyState('No prescriptions sent', 'Upload your medicine prescription and our staff will call you.', html`<a class="sbtn sbtn--primary" href="#/upload">Upload prescription</a>`)
    );
  }

  /* ---------------- Profile: personal & health details, address book ---------------- */
  if (tab === 'profile') {
    let editing = null; // index of address being edited, 'new', or null
    const save = async (body, msg = 'Saved') => {
      profile = (await api('/my/me', { method: 'PUT', auth: true, body })).user;
      auth.profile = profile;
      toast(msg, 'success');
    };

    const addressForm = (a = {}) => html`<div class="scard" data-addrform style="background:var(--surface-2)">
      <div class="form-grid">${ADDRESS_FIELDS.map(
        ([k, label, ac, req]) => html`<div class="sfield ${['line1', 'line2'].includes(k) ? 'full' : ''}"><label for="ad_${k}">${label}${req ? '' : ' (optional)'}</label><input class="sinput" id="ad_${k}" autocomplete="${ac}" value="${a[k] || (k === 'name' ? profile.displayName || '' : k === 'phone' ? profile.phoneNumber || '' : '')}" ${req ? 'required' : ''} /></div>`
      )}</div>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="sbtn sbtn--primary" type="button" data-saveaddr>Save address</button><button class="sbtn sbtn--ghost" type="button" data-canceladdr>Cancel</button></div>
    </div>`;

    const draw = () => {
      const age = ageFrom(profile.dob);
      render(
        box,
        html`<div class="scard"><h2 class="scard__title">Personal details</h2>
          <div class="form-grid">
            <div class="sfield"><label for="pf_name">Full name</label><input class="sinput" id="pf_name" value="${profile.displayName || ''}" autocomplete="name" required /></div>
            <div class="sfield"><label for="pf_phone">Mobile number</label><input class="sinput" id="pf_phone" type="tel" inputmode="tel" maxlength="13" value="${profile.phoneNumber || ''}" autocomplete="tel" required /></div>
            <div class="sfield"><label for="pf_dob">Date of birth</label><input class="sinput" id="pf_dob" type="date" max="${todayIST()}" min="1900-01-01" value="${profile.dob || ''}" autocomplete="bday" /></div>
            <div class="sfield"><label>Age</label><div class="sinput" data-age style="display:flex;align-items:center;background:var(--surface-2)">${age != null ? `${age} years` : 'Calculated from date of birth'}</div></div>
            <div class="sfield"><label for="pf_gender">Gender</label><select class="sselect sinput" id="pf_gender"><option value="">Prefer not to say</option><option>Male</option><option>Female</option><option>Other</option></select></div>
          </div>
          <h3 style="font-size:.92rem;margin:18px 0 6px">General health conditions</h3>
          <p class="muted" style="margin:0 0 10px;font-size:.78rem">Helps our pharmacist and doctors serve you safely. Only staff can see this.</p>
          <div class="chipbar" style="flex-wrap:wrap">${HEALTH_CONDITIONS.map(
            (c) => html`<label class="toggle" style="min-height:36px"><input type="checkbox" value="${c}" data-cond ${profile.healthConditions?.includes(c) ? 'checked' : ''} />${c}</label>`
          )}</div>
          <div class="sfield" style="margin-top:12px"><label for="pf_notes">Other conditions, allergies or regular medicines</label><textarea class="stextarea" id="pf_notes" maxlength="500" placeholder="E.g. allergic to penicillin">${profile.healthNotes || ''}</textarea></div>
          <button class="sbtn sbtn--primary" type="button" data-saveprofile style="margin-top:12px">Save details</button>
        </div>

        <div class="scard"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px"><h2 class="scard__title" style="margin:0">Saved addresses</h2>${editing === null ? html`<button class="sbtn sbtn--outline sbtn--sm" type="button" data-addaddr>+ Add address</button>` : ''}</div>
          ${editing === 'new' ? addressForm() : ''}
          ${profile.addresses?.length
            ? html`<div class="addr-list">${profile.addresses.map((a, i) =>
                editing === i
                  ? addressForm(a)
                  : html`<div class="addr" style="cursor:default"><span style="flex:1"><strong>${a.name}</strong> · ${a.phone}<br />${formatAddress(a)}</span><span style="display:flex;flex-direction:column;gap:4px"><button class="linkbtn" type="button" data-editaddr="${i}">Edit</button><button class="linkbtn" type="button" data-deladdr="${i}">Remove</button></span></div>`
              )}</div>`
            : editing === 'new' ? '' : html`<p class="muted">No saved addresses yet. Addresses you use at checkout are saved here automatically.</p>`}
        </div>`
      );
      $('#pf_gender', box).value = profile.gender || '';
      $('#pf_dob', box).addEventListener('input', (e) => {
        const a = ageFrom(e.target.value);
        $('[data-age]', box).textContent = a != null ? `${a} years` : 'Calculated from date of birth';
      });
    };
    draw();

    const readAddress = () => {
      const a = {};
      for (const [k, , , req] of ADDRESS_FIELDS) {
        const input = $(`#ad_${k}`, box);
        if (req && !input.value.trim()) {
          input.focus();
          throw new Error('Please fill in the required address fields');
        }
        a[k] = input.value.trim();
      }
      return a;
    };

    box.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      try {
        if (t.matches('[data-saveprofile]')) {
          const name = $('#pf_name', box);
          const phone = $('#pf_phone', box);
          if (!name.value.trim()) return name.focus(), toast('Enter your name', 'error');
          if (!/^[6-9]\d{9}$/.test(phone.value.replace(/\D/g, '').slice(-10))) return phone.focus(), toast('Enter a valid 10-digit mobile number', 'error');
          await withLoading(t, () =>
            save({
              displayName: name.value,
              phoneNumber: phone.value,
              dob: $('#pf_dob', box).value,
              gender: $('#pf_gender', box).value,
              healthConditions: $$('[data-cond]:checked', box).map((c) => c.value),
              healthNotes: $('#pf_notes', box).value,
            })
          );
          draw();
        } else if (t.matches('[data-addaddr]')) {
          editing = 'new';
          draw();
          $('#ad_line1', box).focus();
        } else if (t.matches('[data-editaddr]')) {
          editing = Number(t.dataset.editaddr);
          draw();
        } else if (t.matches('[data-canceladdr]')) {
          editing = null;
          draw();
        } else if (t.matches('[data-saveaddr]')) {
          const a = readAddress();
          const list = [...(profile.addresses || [])];
          if (editing === 'new') list.unshift(a);
          else list[editing] = a;
          await withLoading(t, () => save({ addresses: list }, 'Address saved'));
          editing = null;
          draw();
        } else if (t.matches('[data-deladdr]')) {
          if (!confirm('Remove this address?')) return;
          await save({ addresses: profile.addresses.filter((_, i) => i !== Number(t.dataset.deladdr)) }, 'Address removed');
          draw();
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
}
