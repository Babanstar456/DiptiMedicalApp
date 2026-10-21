// Shared helpers for the admin panel: API, escaping, formatting, modals, forms, lists.
import { auth } from '../firebase-init.js';

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------------- Safe HTML templating ---------------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
// html`<p>${userText}</p>` escapes values; nested html`` / raw() / arrays are inserted as-is.
export function html(strings, ...vals) {
  const out = strings.reduce((acc, str, i) => {
    const v = vals[i - 1];
    const piece = v instanceof Raw ? v.s : Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('') : esc(v);
    return acc + piece + str;
  });
  return raw(out);
}
export function el(markup) {
  const t = document.createElement('template');
  t.innerHTML = String(markup).trim();
  return t.content.firstElementChild;
}

/* ---------------- Formatting ---------------- */
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const money = (n) => inr.format(Number(n) || 0);
export const num = (n) => (Number(n) || 0).toLocaleString('en-IN');
export const fmtDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtTime = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export const monthStr = () => todayStr().slice(0, 7);
export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const label = (s) => String(s || '').replace(/-/g, ' ');
const sentence = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const BADGES = {
  ok: ['delivered', 'completed', 'paid', 'token-paid', 'present', 'active', 'confirmed', 'admin', 'called', 'ordered'],
  warn: ['pending', 'packed', 'unpaid', 'half-day', 'draft', 'unpaid-leave', 'low', 'pharmacist', 'awaiting-payment', 'new'],
  bad: ['cancelled', 'absent', 'no-show', 'refunded', 'inactive', 'expired', 'out'],
  info: ['out-for-delivery', 'paid-leave', 'holiday'],
};
export function badge(status, text) {
  const kind = Object.keys(BADGES).find((k) => BADGES[k].includes(status)) || '';
  return html`<span class="badge ${kind ? `badge--${kind}` : ''}">${sentence(String(text ?? label(status)))}</span>`;
}

export const debounce = (fn, ms = 300) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
export const qs = (o) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();

/* ---------------- Icons ---------------- */
export const ICONS = {
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  print: 'M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3zm-3 11H8v-5h8v5zm3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-1-9H6v4h12V3z',
  download: 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z',
  camera: 'M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4zM9 2 7.2 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.2L15 2H9z',
  tag: 'M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .6.2 1.1.6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8zM5.5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  refresh: 'M17.6 6.4A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4l-2.4 2.4z',
  left: 'M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z',
  right: 'M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z',
};
export const icon = (name) => raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`);

/* ---------------- API ---------------- */
export async function api(path, { method = 'GET', body } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  const res = await fetch(path.startsWith('/api') ? path : `/api/admin${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

// Opens a private image (e.g. a customer's prescription) in a new tab using the signed-in staff token.
export async function openPrivateImage(id) {
  const win = window.open('', '_blank');
  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/admin/uploads/private/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Could not open the image');
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location = url;
    else window.location.assign(url);
  } catch (err) {
    win?.close();
    toastError(err);
  }
}

/* ---------------- Page chrome ---------------- */
export function setPage(title, actions = []) {
  $('#pageTitle').textContent = title;
  document.title = `${title} · Dipti Medical Admin`;
  const box = $('#pageActions');
  box.replaceChildren(...actions);
}
export function button(text, { kind = '', iconName, onClick, title } = {}) {
  const b = el(html`<button type="button" class="b ${kind ? `b--${kind}` : ''}" ${raw(title ? `title="${esc(title)}" aria-label="${esc(title)}"` : '')}>${iconName ? icon(iconName) : ''}<span>${text}</span></button>`);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
export async function withLoading(btn, fn) {
  btn.classList.add('is-loading');
  btn.disabled = true;
  try {
    return await fn();
  } finally {
    btn.classList.remove('is-loading');
    btn.disabled = false;
  }
}

let toastTimer;
export function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast is-visible ${type ? `toast--${type}` : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 3500);
}
export const toastError = (err) => toast(err?.message || 'Something went wrong', 'error');

export const skeleton = (n = 5) => html`<div class="skeleton-rows">${Array.from({ length: n }, () => raw('<div class="skeleton"></div>'))}</div>`;
export const emptyState = (title, text = '') => html`<div class="empty"><strong>${title}</strong>${text}</div>`;

/* ---------------- Modal ---------------- */
export function modal({ title, body, footer = [], wide = false, onClose } = {}) {
  const root = el(html`
    <div class="modal ${wide ? 'modal--wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal__box">
        <div class="modal__head">
          <h2 class="modal__title">${title}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Close">${icon('close')}</button>
        </div>
        <div class="modal__body"></div>
        <div class="modal__foot"></div>
      </div>
    </div>`);
  const bodyEl = $('.modal__body', root);
  const foot = $('.modal__foot', root);
  if (typeof body === 'string' || body instanceof Raw) bodyEl.innerHTML = String(body);
  else if (body) bodyEl.append(body);
  if (footer.length) foot.append(...footer);
  else foot.remove();

  const prevFocus = document.activeElement;
  const close = () => {
    root.remove();
    document.removeEventListener('keydown', onKey);
    if (!$('.modal')) document.body.style.overflow = '';
    prevFocus?.focus?.();
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && root === $$('.modal').at(-1) && close();
  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  $('#modalRoot').append(root);
  document.body.style.overflow = 'hidden';
  setTimeout(() => ($('input:not([type=hidden]),select,textarea', bodyEl) || $('[data-close]', root)).focus({ preventScroll: true }), 50);
  return { root, body: bodyEl, foot, close };
}

export function confirmDialog(message, { okText = 'Confirm', danger = false, title = 'Are you sure?' } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const yes = button(okText, { kind: danger ? 'danger' : 'primary' });
    const no = button('Cancel');
    const m = modal({ title, body: html`<p style="margin:0">${message}</p>`, footer: [no, yes], onClose: () => resolve(ok) });
    no.addEventListener('click', m.close);
    yes.addEventListener('click', () => {
      ok = true;
      m.close();
    });
  });
}

/* ---------------- Images (resized in the browser, then uploaded) ---------------- */
export async function resizeImage(file, max = 1000) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('Could not read this image');
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let data = c.toDataURL('image/webp', 0.82);
  if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', 0.85);
  return data;
}
export async function uploadImage(file) {
  const data = await resizeImage(file);
  const { url } = await api('/uploads', { method: 'POST', body: { data } });
  return url;
}

/* ---------------- Form builder ----------------
 * field: { name, label, type, required, half, hint, options, placeholder, min, max, step, default }
 * types: text email tel number money date time month textarea select combo switch days image images section custom
 */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const optionCache = new Map();

export async function loadOptions(path, labelKey = 'name') {
  if (!optionCache.has(path)) {
    optionCache.set(
      path,
      api(path).then((r) => (r.items || r).map((x) => ({ value: x._id, label: typeof labelKey === 'function' ? labelKey(x) : x[labelKey] })))
    );
    optionCache.get(path).catch(() => optionCache.delete(path));
  }
  return optionCache.get(path);
}
export const clearOptionCache = () => optionCache.clear();

function imagesField(f, urls) {
  const wrap = el(html`<div class="imgs" data-field="${f.name}"></div>`);
  let list = [...(urls || [])];
  const multiple = f.type === 'images';
  const draw = () => {
    wrap.innerHTML = String(html`${list.map((u, i) => html`<div class="imgs__item"><img src="${u}" alt="" /><button type="button" data-rm="${i}" aria-label="Remove image">×</button></div>`)}
      ${multiple || !list.length ? html`<label class="imgs__add">${icon('camera')}${multiple ? 'Add photos' : 'Add photo'}<input type="file" accept="image/*" ${raw(multiple ? 'multiple' : '')} /></label>` : ''}`);
  };
  wrap.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      list.splice(Number(rm.dataset.rm), 1);
      draw();
    }
  });
  wrap.addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])].slice(0, multiple ? 6 : 1);
    if (!files.length) return;
    const addLabel = $('.imgs__add', wrap);
    addLabel.textContent = 'Uploading…';
    try {
      for (const file of files) list.push(await uploadImage(file));
    } catch (err) {
      toastError(err);
    }
    draw();
  });
  wrap.getValue = () => (multiple ? list : list[0] || '');
  draw();
  return wrap;
}

export function renderFields(fields, values = {}) {
  const grid = el('<div class="fgrid"></div>');
  for (const f of fields) {
    if (f.type === 'section') {
      grid.append(el(html`<div class="f--section">${f.label}</div>`));
      continue;
    }
    const v = values[f.name] ?? f.default ?? '';
    const id = `f_${f.name}_${Math.random().toString(36).slice(2, 7)}`;
    const wrap = el(html`<div class="f ${f.half ? '' : 'f--full'}" data-name="${f.name}"></div>`);
    const lbl = html`<label for="${id}">${f.label}${f.required ? raw(' <span class="f__req">*</span>') : ''}</label>`;
    const attrs = raw(
      [
        f.required ? 'required' : '',
        f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '',
        f.min !== undefined ? `min="${esc(f.min)}"` : '',
        f.max !== undefined ? `max="${esc(f.max)}"` : '',
        f.step !== undefined ? `step="${esc(f.step)}"` : '',
        f.maxlength ? `maxlength="${f.maxlength}"` : '',
        f.readonly ? 'readonly' : '',
      ].join(' ')
    );

    switch (f.type) {
      case 'textarea':
        wrap.innerHTML = String(html`${lbl}<textarea id="${id}" class="textarea" name="${f.name}" ${attrs}>${v}</textarea>`);
        break;
      case 'select': {
        const opts = Array.isArray(f.options) ? f.options : [];
        wrap.innerHTML = String(html`${lbl}<select id="${id}" class="select" name="${f.name}" ${attrs}>
          <option value="">${f.required ? '— Select —' : f.emptyLabel || '— None —'}</option>
          ${opts.map((o) => html`<option value="${o.value ?? o}">${o.label ?? label(o)}</option>`)}</select>`);
        const sel = $('select', wrap);
        const val = typeof v === 'object' && v ? v._id : v;
        if (typeof f.options === 'function') {
          sel.disabled = true;
          f.options().then((list) => {
            sel.insertAdjacentHTML('beforeend', String(html`${list.map((o) => html`<option value="${o.value}">${o.label}</option>`)}`));
            sel.value = val ?? '';
            if (!sel.value && f.required && list.length === 1) sel.value = list[0].value;
            sel.disabled = !!f.readonly;
          }, toastError);
        } else sel.value = val ?? '';
        break;
      }
      case 'combo': {
        // Free text with suggestions: pick an existing name or type a new one.
        const listId = `${id}_list`;
        wrap.innerHTML = String(html`${lbl}<input id="${id}" class="input" name="${f.name}" value="${v}" list="${listId}" autocomplete="off" ${attrs} /><datalist id="${listId}"></datalist>`);
        if (typeof f.options === 'function') {
          f.options().then((list) => {
            $('datalist', wrap).innerHTML = String(html`${list.map((o) => html`<option value="${o.label}"></option>`)}`);
          }, toastError);
        }
        break;
      }
      case 'switch':
        wrap.innerHTML = String(html`<label class="switch" for="${id}"><span>${f.label}</span><input id="${id}" type="checkbox" name="${f.name}" ${raw(v === true || (v === '' && f.default) ? 'checked' : '')} /></label>`);
        break;
      case 'days':
        wrap.innerHTML = String(html`<span class="f__label">${f.label}</span><div class="daypick">${DAYS.map(
          (d) => html`<label><input type="checkbox" name="${f.name}" value="${d}" ${raw((v || []).includes(d) ? 'checked' : '')} /><span>${d}</span></label>`
        )}</div>`);
        break;
      case 'image':
      case 'images':
        wrap.innerHTML = String(html`<span class="f__label">${f.label}</span>`);
        wrap.append(imagesField(f, f.type === 'image' ? (v ? [v] : []) : v));
        break;
      case 'custom':
        wrap.innerHTML = String(html`${f.label ? html`<span class="f__label">${f.label}</span>` : ''}`);
        wrap.append(f.render(values));
        break;
      default: {
        const type = f.type === 'money' ? 'number' : f.type || 'text';
        const step = f.type === 'money' && f.step === undefined ? raw('step="0.01" min="0"') : '';
        const val = f.type === 'date' && v ? toDateInput(v) : v;
        wrap.innerHTML = String(html`${lbl}<input id="${id}" class="input" type="${type}" name="${f.name}" value="${val}" ${attrs} ${step} ${raw(
          type === 'number' ? 'inputmode="decimal"' : type === 'tel' ? 'inputmode="tel"' : ''
        )} />`);
      }
    }
    if (f.hint) wrap.append(el(html`<div class="f__hint">${f.hint}</div>`));
    grid.append(wrap);
  }
  return grid;
}

export function readFields(container, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'section' || f.readonly) continue;
    const wrap = container.querySelector(`[data-name="${f.name}"]`);
    if (!wrap) continue;
    if (f.type === 'switch') out[f.name] = $('input', wrap).checked;
    else if (f.type === 'days') out[f.name] = $$('input:checked', wrap).map((i) => i.value);
    else if (f.type === 'image' || f.type === 'images') out[f.name] = $('[data-field]', wrap).getValue();
    else if (f.type === 'custom') out[f.name] = f.read ? f.read(wrap) : undefined;
    else {
      const input = $('input,select,textarea', wrap);
      let v = input.value.trim();
      if ((f.type === 'number' || f.type === 'money') && v !== '') v = Number(v);
      out[f.name] = v;
    }
  }
  return out;
}

export function validateFields(container, fields) {
  for (const f of fields) {
    const input = container.querySelector(`[data-name="${f.name}"] input, [data-name="${f.name}"] select, [data-name="${f.name}"] textarea`);
    if (input && !input.checkValidity()) {
      input.focus();
      input.reportValidity();
      return false;
    }
  }
  return true;
}

/* ---------------- Generic list + form page ----------------
 * cfg: { title, endpoint, singular, columns:[{label, render(item), num, main}], fields: array | (item) => array,
 *        filters:[{name, label, options}], search, toForm(item), fromForm(data, item), rowClick(item, reload),
 *        actions(reload) → extra buttons, onAction(name, item, reload) for [data-action] buttons in rows,
 *        canDelete, sort, limit, defaultFilters }
 */
export function resourcePage(cfg) {
  return async function render(view, params = {}) {
    const state = { q: '', page: 1, ...cfg.defaultFilters, ...params };
    const addBtn = cfg.canCreate === false ? null : button(`Add ${cfg.singular}`, { kind: 'primary', iconName: 'plus', onClick: () => openForm(null) });
    setPage(cfg.title, [...(cfg.actions ? cfg.actions(() => load()) : []), ...(addBtn ? [addBtn] : [])]);

    view.innerHTML = String(html`
      <div class="toolbar">
        ${cfg.search === false ? '' : html`<div class="search">${icon('search')}<input class="input" type="search" placeholder="${cfg.searchPlaceholder || 'Search…'}" data-q value="${state.q}" /></div>`}
        <div class="filters">${(cfg.filters || []).map((f) =>
          f.type === 'date'
            ? html`<input class="input" type="date" data-filter="${f.name}" aria-label="${f.label}" />`
            : html`<select class="select" data-filter="${f.name}" aria-label="${f.label}"><option value="">${f.label}</option>${(Array.isArray(f.options) ? f.options : []).map(
            (o) => html`<option value="${o.value ?? o}">${o.label ?? label(o)}</option>`
          )}</select>`
        )}</div>
        ${cfg.toolbarExtra ? raw(cfg.toolbarExtra) : ''}
      </div>
      <div data-list>${skeleton()}</div>`);

    for (const f of cfg.filters || []) {
      const sel = $(`[data-filter="${f.name}"]`, view);
      if (f.type === 'date') sel.value = state[f.name] ?? '';
      else if (typeof f.options === 'function') {
        f.options().then((list) => {
          sel.insertAdjacentHTML('beforeend', String(html`${list.map((o) => html`<option value="${o.value}">${o.label}</option>`)}`));
          sel.value = state[f.name] ?? '';
        });
      } else sel.value = state[f.name] ?? '';
      sel.addEventListener('change', () => {
        state[f.name] = sel.value;
        state.page = 1;
        load();
      });
    }
    $('[data-q]', view)?.addEventListener(
      'input',
      debounce((e) => {
        state.q = e.target.value.trim();
        state.page = 1;
        load();
      })
    );

    const listEl = $('[data-list]', view);
    let items = [];

    async function load() {
      try {
        const query = { limit: cfg.limit || 20, sort: cfg.sort, ...state };
        const res = await api(`${cfg.endpoint}?${qs(query)}`);
        items = res.items;
        if (!items.length) {
          listEl.innerHTML = String(emptyState(state.q ? 'No matches' : `No ${cfg.title.toLowerCase()} yet`, state.q ? 'Try a different search.' : cfg.emptyHint || ''));
          return;
        }
        listEl.innerHTML = String(html`
          <div class="table-wrap"><table class="table">
            <thead><tr>${cfg.columns.map((c) => html`<th class="${c.num ? 'num' : ''}">${c.label}</th>`)}</tr></thead>
            <tbody>${items.map(
              (it, i) => html`<tr class="is-clickable" data-i="${i}" tabindex="0">${cfg.columns.map(
                (c) => html`<td class="${c.num ? 'num' : ''} ${c.main ? 'td-main' : ''}" data-label="${c.label}">${c.render(it)}</td>`
              )}</tr>`
            )}</tbody>
          </table></div>
          ${res.pages > 1 ? html`<div class="pager"><span>${num(res.total)} total · page ${res.page} of ${res.pages}</span><span>
            <button class="b b--sm" data-pg="-1" ${raw(res.page <= 1 ? 'disabled' : '')}>${icon('left')}<span>Prev</span></button>
            <button class="b b--sm" data-pg="1" ${raw(res.page >= res.pages ? 'disabled' : '')}><span>Next</span>${icon('right')}</button></span></div>` : html`<div class="pager"><span>${num(res.total)} total</span></div>`}`);
      } catch (err) {
        listEl.innerHTML = String(emptyState('Could not load', err.message));
      }
    }

    listEl.addEventListener('click', (e) => {
      const pg = e.target.closest('[data-pg]');
      if (pg) {
        state.page += Number(pg.dataset.pg);
        load();
        return;
      }
      const act = e.target.closest('[data-action]');
      const row = e.target.closest('tr[data-i]');
      if (act && row && cfg.onAction) return cfg.onAction(act.dataset.action, items[row.dataset.i], load);
      if (e.target.closest('button, a, select, input')) return;
      if (row) (cfg.rowClick || openForm)(items[row.dataset.i], load);
    });
    listEl.addEventListener('keydown', (e) => {
      const row = e.target.closest('tr[data-i]');
      if (row && e.key === 'Enter') (cfg.rowClick || openForm)(items[row.dataset.i], load);
    });

    async function openForm(item) {
      const fields = typeof cfg.fields === 'function' ? cfg.fields(item) : cfg.fields;
      const values = item ? (cfg.toForm ? cfg.toForm(item) : item) : {};
      const form = renderFields(fields, values);
      const save = button(item ? 'Save changes' : `Add ${cfg.singular}`, { kind: 'primary' });
      const cancel = button('Cancel');
      const footer = [];
      if (item && cfg.canDelete !== false) {
        const del = button('Delete', { kind: 'danger' });
        del.addEventListener('click', async () => {
          if (!(await confirmDialog(`Delete this ${cfg.singular.toLowerCase()}? This cannot be undone.`, { okText: 'Delete', danger: true }))) return;
          await withLoading(del, async () => {
            try {
              await api(`${cfg.endpoint}/${item._id}`, { method: 'DELETE' });
              toast(`${cfg.singular} deleted`, 'success');
              m.close();
              clearOptionCache();
              load();
            } catch (err) {
              toastError(err);
            }
          });
        });
        footer.push(del, el('<span class="spacer"></span>'));
      }
      footer.push(cancel, save);
      const m = modal({ title: item ? `Edit ${cfg.singular.toLowerCase()}` : `New ${cfg.singular.toLowerCase()}`, body: form, footer, wide: cfg.wideForm });
      cfg.afterRender?.(form, item);
      cancel.addEventListener('click', m.close);
      save.addEventListener('click', () =>
        withLoading(save, async () => {
          if (!validateFields(form, fields)) return;
          let data = readFields(form, fields);
          if (cfg.fromForm) data = cfg.fromForm(data, item);
          try {
            await api(item ? `${cfg.endpoint}/${item._id}` : cfg.endpoint, { method: item ? 'PUT' : 'POST', body: data });
            toast(item ? 'Saved' : `${cfg.singular} added`, 'success');
            clearOptionCache();
            m.close();
            load();
          } catch (err) {
            toastError(err);
          }
        })
      );
    }

    if (params.new) openForm(null);
    await load();
  };
}

/* ---------------- Export / print ---------------- */
export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function printHTML(markup) {
  $('#printArea').innerHTML = String(markup);
  window.print();
}
export const SHOP = { name: 'Dipti Medical', tagline: 'Pharmacy & Clinic' };
