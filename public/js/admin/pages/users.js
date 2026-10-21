import { $, html, raw, api, setPage, toast, toastError, skeleton, emptyState, icon, debounce, qs, fmtDateTime, badge, confirmDialog } from '../core.js';

const ROLES = [
  ['customer', 'Customer'],
  ['pharmacist', 'Staff (pharmacist)'],
  ['admin', 'Admin'],
];

export default async function users(view, params, me) {
  const state = { q: '', role: '', page: 1 };
  setPage('Users & access');
  view.innerHTML = String(html`
    <p class="muted" style="margin:0 0 12px">People appear here after they sign in once. <strong>Staff</strong> can use pharmacy and clinic sections; <strong>Admins</strong> also manage HR, payroll and access.</p>
    <div class="toolbar">
      <div class="search">${icon('search')}<input class="input" type="search" placeholder="Search name, email or phone" data-q /></div>
      <select class="select" data-role aria-label="Role"><option value="">All roles</option>${ROLES.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>
    </div>
    <div data-list>${skeleton()}</div>`);
  const listEl = $('[data-list]', view);

  async function load() {
    try {
      const r = await api(`/users?${qs(state)}`);
      if (!r.items.length) return (listEl.innerHTML = String(emptyState('No users found')));
      listEl.innerHTML = String(html`<div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Last login</th><th>Role</th><th>Access</th></tr></thead><tbody>
        ${r.items.map((u) => {
          const locked = u.isOwner || u.uid === me.uid;
          return html`<tr data-id="${u._id}">
            <td class="td-main" data-label="User"><div class="cell-main"><img class="thumb thumb--round" src="${u.photoURL || '/img/logo-mark.png'}" alt="" loading="lazy" /><div><strong>${u.displayName || '—'}</strong><small>${u.email || u.phoneNumber || ''}</small></div></div></td>
            <td data-label="Last login">${fmtDateTime(u.lastLoginAt)}</td>
            <td data-label="Role">${locked
              ? html`${badge(u.role)} <small class="muted">${u.isOwner ? 'owner' : 'you'}</small>`
              : html`<select class="select" data-role-of="${u._id}" aria-label="Role for ${u.displayName || u.email}" style="width:auto">${ROLES.map(
                  ([v, l]) => html`<option value="${v}" ${raw(u.role === v ? 'selected' : '')}>${l}</option>`
                )}</select>`}</td>
            <td data-label="Access">${locked ? badge('active') : html`<button type="button" class="b b--sm ${u.isActive ? 'b--danger' : ''}" data-toggle="${u._id}" data-active="${u.isActive}">${u.isActive ? 'Block' : 'Unblock'}</button>`}</td>
          </tr>`;
        })}</tbody></table></div>
        ${r.pages > 1 ? html`<div class="pager"><span>Page ${r.page} of ${r.pages}</span><span><button class="b b--sm" data-pg="-1" ${raw(r.page <= 1 ? 'disabled' : '')}>Prev</button> <button class="b b--sm" data-pg="1" ${raw(r.page >= r.pages ? 'disabled' : '')}>Next</button></span></div>` : ''}`);
    } catch (err) {
      listEl.innerHTML = String(emptyState('Could not load users', err.message));
    }
  }

  const patch = async (id, body, msg) => {
    try {
      await api(`/users/${id}`, { method: 'PATCH', body });
      toast(msg, 'success');
    } catch (err) {
      toastError(err);
    }
    load();
  };
  listEl.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-role-of]');
    if (!sel) return;
    const role = sel.value;
    if (role === 'admin' && !(await confirmDialog('Give this person full admin access, including payroll and user management?', { okText: 'Make admin' }))) return load();
    patch(sel.dataset.roleOf, { role }, 'Role updated');
  });
  listEl.addEventListener('click', async (e) => {
    const pg = e.target.closest('[data-pg]');
    if (pg) return (state.page += Number(pg.dataset.pg)), load();
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const active = t.dataset.active === 'true';
    if (active && !(await confirmDialog('Block this user? They will not be able to use the app.', { okText: 'Block', danger: true }))) return;
    patch(t.dataset.toggle, { isActive: !active }, active ? 'User blocked' : 'User unblocked');
  });
  $('[data-q]', view).addEventListener('input', debounce((e) => ((state.q = e.target.value.trim()), (state.page = 1), load())));
  $('[data-role]', view).addEventListener('change', (e) => ((state.role = e.target.value), (state.page = 1), load()));
  load();
}
