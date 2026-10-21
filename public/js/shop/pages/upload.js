import { $, html, render, api, auth, icon, loginUrl, toast, withLoading, uploadPrescription } from '../lib.js';

export default async function upload(view, { config }) {
  const user = await auth.ready;
  // Fresh profile so details saved at checkout are pre-filled
  const p = user ? (await api('/my/me', { auth: true }).catch(() => ({}))).user || auth.profile : null;
  render(
    view,
    html`<div class="wrap" style="max-width:720px">
      <div class="page-head"><div class="crumbs"><a href="#/">Home</a>›<span>Upload prescription</span></div><h1 class="page-title">Upload medicine prescription</h1>
        <p class="muted" style="margin:6px 0 0">Upload your medicine prescription and our staff will call you to confirm the medicines and price. No need to search.</p></div>
      <div class="quick" style="margin:0 0 16px">
        <div class="qcard qcard--green">${icon('camera')}<span><strong>1. Take a photo</strong><small>Clear & readable</small></span></div>
        <div class="qcard qcard--blue">${icon('phone')}<span><strong>2. Our staff call you</strong><small>Confirm & pay</small></span></div>
      </div>
      ${user
        ? html`<div class="scard">
            <label class="upload"><input type="file" accept="image/*" data-file /><span class="upload__thumb" data-thumb>${icon('camera')}</span><span><strong data-label>Add prescription photo</strong><small>Only our pharmacists can see it.</small></span></label>
            <div class="form-grid" style="margin-top:14px">
              <div class="sfield"><label for="u_name">Your name</label><input class="sinput" id="u_name" autocomplete="name" value="${p?.displayName || ''}" /></div>
              <div class="sfield"><label for="u_phone">Mobile number</label><input class="sinput" id="u_phone" type="tel" inputmode="tel" maxlength="13" autocomplete="tel" value="${p?.phoneNumber || ''}" /></div>
              <div class="sfield full"><label for="u_addr">Delivery address (optional)</label><textarea class="stextarea" id="u_addr" maxlength="400"></textarea></div>
              <div class="sfield full"><label for="u_notes">Anything else? (optional)</label><input class="sinput" id="u_notes" maxlength="500" placeholder="E.g. need for 1 month" /></div>
            </div>
            <p class="form-error" data-error hidden></p>
            <button class="sbtn sbtn--primary sbtn--block sbtn--lg" type="button" data-send style="margin-top:14px">Send to pharmacist</button>
          </div>`
        : html`<div class="scard" style="text-align:center"><p>Please sign in so we can keep your prescription private and call you back.</p><a class="sbtn sbtn--primary" href="${loginUrl('#/upload')}">Login / Sign up</a></div>`}
      <p class="muted" style="text-align:center;font-size:.84rem">Prefer to talk? Call <a href="tel:+91${config.phone}" style="color:var(--brand-600);font-weight:600">${config.phone}</a></p>
    </div>`
  );
  if (!user) return;
  let image = null;
  const errorEl = $('[data-error]', view);
  const fail = (m) => ((errorEl.textContent = m), (errorEl.hidden = false), toast(m, 'error'));
  $('[data-file]', view).addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    $('[data-label]', view).textContent = 'Uploading…';
    try {
      image = await uploadPrescription(f);
      $('[data-thumb]', view).innerHTML = `<img src="${image.preview}" alt="Prescription" />`;
      $('[data-label]', view).textContent = 'Photo added. Tap to change.';
    } catch (err) {
      image = null;
      $('[data-label]', view).textContent = 'Add prescription photo';
      fail(err.message);
    }
  });
  $('[data-send]', view).addEventListener('click', (e) =>
    withLoading(e.currentTarget, async () => {
      errorEl.hidden = true;
      if (!image) return fail('Please add a photo of your prescription.');
      try {
        const r = await api('/my/prescriptions', {
          method: 'POST',
          auth: true,
          body: { image: image.id, name: $('#u_name', view).value, phone: $('#u_phone', view).value, address: $('#u_addr', view).value, notes: $('#u_notes', view).value },
        });
        render(view, html`<div class="wrap empty-state" style="max-width:620px">${icon('check')}<strong>Prescription received (${r.requestNo})</strong><p>Our staff will call you shortly on the number you gave. You can see its status in My account.</p><a class="sbtn sbtn--primary" href="#/account/prescriptions">View my requests</a></div>`);
      } catch (err) {
        fail(err.message);
      }
    })
  );
}
