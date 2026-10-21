import {
  $, $$, html, el, raw, api, resourcePage, money, num, fmtDate, badge, setPage, button, modal, withLoading, toast, toastError,
  skeleton, emptyState, icon, todayStr, monthStr, label, confirmDialog, downloadCSV, printHTML, SHOP, renderFields, readFields,
} from '../core.js';
import { thumb } from './catalog.js';

/* ---------------- Staff ---------------- */
const DEPARTMENTS = ['Pharmacy', 'Clinic', 'Delivery', 'Accounts', 'Other'];

export const staff = resourcePage({
  title: 'Staff',
  singular: 'Employee',
  endpoint: '/staff',
  searchPlaceholder: 'Search name, employee ID, phone',
  sort: 'name',
  wideForm: true,
  filters: [
    { name: 'department', label: 'All departments', options: DEPARTMENTS },
    { name: 'isActive', label: 'All statuses', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
  ],
  columns: [
    { label: 'Employee', main: true, render: (s) => html`<div class="cell-main">${thumb(s.photo, true)}<div><strong>${s.name}</strong><small>${s.employeeId} · ${s.designation || s.department}</small></div></div>` },
    { label: 'Phone', render: (s) => (s.phone ? html`<a href="tel:${s.phone}">${s.phone}</a>` : '—') },
    { label: 'Joined', render: (s) => fmtDate(s.joiningDate) },
    { label: 'Monthly pay', num: true, render: (s) => money((s.baseSalary || 0) + (s.allowances || 0)) },
    { label: 'Status', render: (s) => badge(s.isActive ? 'active' : 'inactive') },
  ],
  fields: (item) => [
    { name: 'photo', label: 'Photo', type: 'image' },
    ...(item ? [{ name: 'employeeId', label: 'Employee ID', readonly: true, half: true }] : []),
    { name: 'name', label: 'Full name', required: true, half: true },
    { name: 'designation', label: 'Designation', half: true, placeholder: 'Pharmacist, Cashier, Delivery…' },
    { name: 'department', label: 'Department', type: 'select', options: DEPARTMENTS, required: true, half: true, default: 'Pharmacy' },
    { name: 'phone', label: 'Phone', type: 'tel', half: true },
    { name: 'email', label: 'Email', type: 'email', half: true },
    { name: 'joiningDate', label: 'Joining date', type: 'date', half: true },
    { name: 'isActive', label: 'Currently employed', type: 'switch', half: true, default: true },
    { name: 'address', label: 'Address', type: 'textarea' },
    { type: 'section', label: 'Salary (per month)' },
    { name: 'baseSalary', label: 'Basic salary (₹)', type: 'money', required: true, half: true },
    { name: 'allowances', label: 'Allowances (₹)', type: 'money', half: true, hint: 'HRA, travel etc.' },
    { name: 'fixedDeductions', label: 'Fixed deductions (₹)', type: 'money', half: true, hint: 'PF, ESI, professional tax' },
    { type: 'section', label: 'Bank details' },
    { name: 'bankName', label: 'Bank', half: true },
    { name: 'accountNo', label: 'Account no.', half: true },
    { name: 'ifsc', label: 'IFSC', half: true },
  ],
});

/* ---------------- Attendance ---------------- */
const ATT = [
  ['present', 'P', 'Present'],
  ['absent', 'A', 'Absent'],
  ['half-day', 'H', 'Half day'],
  ['paid-leave', 'PL', 'Paid leave'],
  ['unpaid-leave', 'UL', 'Unpaid leave'],
  ['holiday', 'Hol', 'Holiday'],
];
const shiftDate = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export async function attendance(view, params) {
  let tab = params.tab === 'summary' ? 'summary' : 'daily';
  let date = params.date || todayStr();
  let month = monthStr();
  setPage('Attendance');

  view.innerHTML = String(html`
    <div class="tabs-line" role="tablist"><button type="button" data-tab="daily">Daily register</button><button type="button" data-tab="summary">Monthly summary</button></div>
    <div data-body></div>`);
  const body = $('[data-body]', view);
  view.querySelector('.tabs-line').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) ((tab = b.dataset.tab), draw());
  });

  function draw() {
    $$('[data-tab]', view).forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    return tab === 'daily' ? daily() : summary();
  }

  async function daily() {
    const today = todayStr();
    body.innerHTML = String(html`
      <div class="toolbar">
        <button type="button" class="b" data-day="-1" aria-label="Previous day">${icon('left')}</button>
        <input class="input" type="date" data-date value="${date}" max="${today}" aria-label="Date" />
        <button type="button" class="b" data-day="1" aria-label="Next day" ${raw(date >= today ? 'disabled' : '')}>${icon('right')}</button>
        <button type="button" class="b" data-all>Mark all present</button>
      </div>
      <div class="legend">${ATT.map(([, k, l]) => html`<span><strong>${k}</strong> ${l}</span>`)}</div>
      <div data-rows>${skeleton(4)}</div>`);
    const rowsEl = $('[data-rows]', body);
    let r;
    try {
      r = await api(`/attendance?date=${date}`);
    } catch (err) {
      return (rowsEl.innerHTML = String(emptyState('Could not load', err.message)));
    }
    if (!r.items.length) return (rowsEl.innerHTML = String(emptyState('No active staff', html`Add employees under <a href="#/staff">Staff</a> first.`)));

    rowsEl.innerHTML = String(html`<div class="att">${r.items.map(
      ({ staff: s, record: rec }) => html`<div class="att__row" data-staff="${s._id}" data-status="${rec?.status || ''}">
        <div class="att__who">${thumb(s.photo, true)}<div><strong>${s.name}</strong><small>${s.employeeId}${s.designation ? ` · ${s.designation}` : ''}</small></div></div>
        <div class="seg" role="group" aria-label="Status for ${s.name}">${ATT.map(
          ([v, k, l]) => html`<button type="button" data-s="${v}" title="${l}" aria-pressed="${rec?.status === v}" class="${rec?.status === v ? 'is-on' : ''}">${k}</button>`
        )}</div>
        <div class="att__times"><input class="input" type="time" data-in value="${rec?.checkIn || ''}" aria-label="Check-in" /><input class="input" type="time" data-out value="${rec?.checkOut || ''}" aria-label="Check-out" /></div>
      </div>`
    )}</div>
    <div class="sticky-save"><button type="button" class="b b--primary" data-save>Save attendance · ${fmtDate(date)}</button></div>`);

    const setStatus = (row, s) => {
      row.dataset.status = row.dataset.status === s ? '' : s;
      $$('.seg button', row).forEach((b) => {
        const on = b.dataset.s === row.dataset.status;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on);
      });
    };
    rowsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.seg button');
      if (b) setStatus(b.closest('.att__row'), b.dataset.s);
    });
    $('[data-save]', rowsEl).addEventListener('click', (e) =>
      withLoading(e.currentTarget, async () => {
        const records = $$('.att__row', rowsEl).map((row) => ({
          staff: row.dataset.staff,
          status: row.dataset.status,
          checkIn: $('[data-in]', row).value,
          checkOut: $('[data-out]', row).value,
        }));
        try {
          await api('/attendance', { method: 'PUT', body: { date, records } });
          toast(`Attendance saved for ${fmtDate(date)}`, 'success');
        } catch (err) {
          toastError(err);
        }
      })
    );
    $('[data-all]', body).addEventListener('click', () => $$('.att__row', rowsEl).forEach((row) => row.dataset.status !== 'present' && setStatus(row, 'present')));
  }

  body.addEventListener('change', (e) => {
    if (e.target.matches('[data-date]') && e.target.value) ((date = e.target.value), daily());
    if (e.target.matches('[data-month]') && e.target.value) ((month = e.target.value), summary());
  });
  body.addEventListener('click', (e) => {
    const d = e.target.closest('[data-day]');
    if (d) ((date = shiftDate(date, Number(d.dataset.day))), daily());
  });

  async function summary() {
    body.innerHTML = String(html`<div class="toolbar"><input class="input" type="month" data-month value="${month}" max="${monthStr()}" aria-label="Month" /></div><div data-rows>${skeleton(4)}</div>`);
    const rowsEl = $('[data-rows]', body);
    try {
      const r = await api(`/attendance/summary?month=${month}`);
      if (!r.items.length) return (rowsEl.innerHTML = String(emptyState('No active staff')));
      rowsEl.innerHTML = String(html`<div class="table-wrap"><table class="table"><thead><tr><th>Employee</th>${ATT.map(([, , l]) => html`<th class="num">${l}</th>`)}</tr></thead><tbody>
        ${r.items.map(
          ({ staff: s, counts: c }) => html`<tr><td class="td-main" data-label="Employee"><strong>${s.name}</strong> <small class="muted">${s.employeeId}</small></td>
            ${ATT.map(([v, , l]) => html`<td class="num" data-label="${l}">${num(c[v])}</td>`)}</tr>`
        )}</tbody></table></div><p class="muted">${r.daysInMonth} days in month. Unmarked days are treated as paid in payroll.</p>`);
    } catch (err) {
      rowsEl.innerHTML = String(emptyState('Could not load', err.message));
    }
  }

  draw();
}

/* ---------------- Payroll ---------------- */
const monthName = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const deductionsOf = (p) => p.absenceDeduction + p.fixedDeductions + p.otherDeductions;

function payslipHTML(p) {
  const s = p.staff || {};
  return html`<div class="head"><div><h1>${SHOP.name}</h1><div>Payslip · ${monthName(p.month)}</div></div><div style="text-align:right"><strong>${s.name}</strong><br />${s.employeeId} · ${s.designation || s.department || ''}</div></div>
    <table><tbody>
      <tr><th>Days in month</th><td class="r">${p.daysInMonth}</td><th>Present</th><td class="r">${p.present}</td></tr>
      <tr><th>Half days</th><td class="r">${p.halfDay}</td><th>Paid leave / holidays</th><td class="r">${p.paidLeave + p.holiday}</td></tr>
      <tr><th>Absent</th><td class="r">${p.absent}</td><th>Unpaid leave</th><td class="r">${p.unpaidLeave}</td></tr>
    </tbody></table>
    <table><thead><tr><th>Earnings</th><th class="r">Amount</th><th>Deductions</th><th class="r">Amount</th></tr></thead><tbody>
      <tr><td>Basic salary</td><td class="r">${money(p.baseSalary)}</td><td>Absence / unpaid days</td><td class="r">${money(p.absenceDeduction)}</td></tr>
      <tr><td>Allowances</td><td class="r">${money(p.allowances)}</td><td>PF / ESI / PT</td><td class="r">${money(p.fixedDeductions)}</td></tr>
      <tr><td>Bonus / incentive</td><td class="r">${money(p.bonus)}</td><td>Advance / other</td><td class="r">${money(p.otherDeductions)}</td></tr>
      <tr><th>Total earnings</th><th class="r">${money(p.grossSalary + p.bonus)}</th><th>Total deductions</th><th class="r">${money(deductionsOf(p))}</th></tr>
    </tbody></table>
    <h2 style="font-size:15px;margin-top:14px">Net pay: ${money(p.netPay)}</h2>
    <p>${p.status === 'paid' ? `Paid on ${fmtDate(p.paidOn)} via ${(p.paymentMethod || '').toUpperCase()}` : 'Status: not yet paid'}${s.accountNo ? ` · A/c ${s.accountNo} ${s.ifsc || ''}` : ''}</p>
    ${p.note ? html`<p>Note: ${p.note}</p>` : ''}
    <p style="margin-top:40px;display:flex;justify-content:space-between"><span>Employee signature</span><span>Authorised signatory</span></p>`;
}

function payslipDialog(p, onChange) {
  const draft = p.status !== 'paid';
  const fields = [
    { name: 'bonus', label: 'Bonus / incentive (₹)', type: 'money', half: true },
    { name: 'otherDeductions', label: 'Advance / other deduction (₹)', type: 'money', half: true },
    { name: 'note', label: 'Note', maxlength: 300 },
  ];
  const body = el(String(html`<div>
    <dl class="kv" style="margin-bottom:14px">
      <div><dt>Employee</dt><dd>${p.staff?.name} · ${p.staff?.employeeId}</dd></div>
      <div><dt>Attendance</dt><dd>${p.present} present · ${p.halfDay} half · ${p.absent} absent · ${p.paidLeave} PL · ${p.unpaidLeave} UL · ${p.holiday} hol · ${p.unmarked} unmarked</dd></div>
      <div><dt>Gross (basic + allowances)</dt><dd>${money(p.grossSalary)}</dd></div>
      <div><dt>Absence deduction</dt><dd>− ${money(p.absenceDeduction)}</dd></div>
      <div><dt>Fixed deductions</dt><dd>− ${money(p.fixedDeductions)}</dd></div>
      <div><dt>Bonus</dt><dd>+ ${money(p.bonus)}</dd></div>
      <div><dt>Other deductions</dt><dd>− ${money(p.otherDeductions)}</dd></div>
    </dl>
    <div class="totals"><div class="grand"><span>Net pay</span><span>${money(p.netPay)}</span></div></div>
    <div style="margin-top:12px">${badge(p.status)} ${p.status === 'paid' ? html`<span class="muted">on ${fmtDate(p.paidOn)} · ${(p.paymentMethod || '').toUpperCase()}</span>` : ''}</div>
  </div>`));
  let form;
  if (draft) {
    form = renderFields(fields, p);
    body.append(el('<div style="height:14px"></div>'), form);
  }

  const footer = [button('Print payslip', { iconName: 'print', onClick: () => printHTML(payslipHTML(p)) })];
  const act = async (b, path, bodyData, msg) =>
    withLoading(b, async () => {
      try {
        await api(path, { method: 'POST', body: bodyData });
        toast(msg, 'success');
        dlg.close();
        onChange();
      } catch (err) {
        toastError(err);
      }
    });
  if (draft) {
    const save = button('Save');
    save.addEventListener('click', () =>
      withLoading(save, async () => {
        try {
          await api(`/payroll/${p._id}`, { method: 'PUT', body: readFields(form, fields) });
          toast('Payslip updated', 'success');
          dlg.close();
          onChange();
        } catch (err) {
          toastError(err);
        }
      })
    );
    const method = el(html`<select class="select" aria-label="Payment method" style="width:auto"><option value="bank">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option></select>`);
    const pay = button('Mark paid', { kind: 'primary' });
    pay.addEventListener('click', () => act(pay, `/payroll/${p._id}/pay`, { paymentMethod: method.value }, `Paid ${money(p.netPay)} to ${p.staff?.name}`));
    footer.push(save, method, pay);
  } else {
    const unpay = button('Mark unpaid');
    unpay.addEventListener('click', async () => {
      if (await confirmDialog('Move this payslip back to draft?')) act(unpay, `/payroll/${p._id}/unpay`, {}, 'Payslip moved to draft');
    });
    footer.push(unpay);
  }
  const dlg = modal({ title: `Payslip · ${monthName(p.month)}`, body, footer });
}

export async function payroll(view) {
  let month = monthStr();
  let data;
  const gen = button('Generate payroll', { kind: 'primary', iconName: 'refresh' });
  const csv = button('Export CSV', { iconName: 'download', title: 'Export salary report (CSV)' });
  const print = button('Print report', { iconName: 'print', title: 'Print salary report' });
  setPage('Payroll', [csv, print, gen]);

  view.innerHTML = String(html`
    <div class="toolbar"><input class="input" type="month" data-month value="${month}" max="${monthStr()}" aria-label="Month" />
      <span class="muted" style="font-size:.8rem">Generate builds draft payslips from attendance. Paid payslips are never changed.</span></div>
    <div class="tiles" data-tiles></div>
    <div data-list>${skeleton()}</div>`);
  const listEl = $('[data-list]', view);

  async function load() {
    listEl.innerHTML = String(skeleton());
    try {
      data = await api(`/payroll?month=${month}`);
    } catch (err) {
      return (listEl.innerHTML = String(emptyState('Could not load payroll', err.message)));
    }
    const t = data.totals;
    $('[data-tiles]', view).innerHTML = String(html`
      <div class="tile"><div class="tile__label">Gross salary</div><div class="tile__value">${money(t.gross)}</div><div class="tile__meta">${num(data.items.length)} employees</div></div>
      <div class="tile"><div class="tile__label">Deductions</div><div class="tile__value">${money(t.deductions)}</div></div>
      <div class="tile"><div class="tile__label">Net payable</div><div class="tile__value">${money(t.net)}</div><div class="tile__meta">incl. ${money(t.bonus)} bonus</div></div>
      <div class="tile ${t.net - t.paid > 0 ? 'tile--warn' : ''}"><div class="tile__label">Pending to pay</div><div class="tile__value">${money(t.net - t.paid)}</div><div class="tile__meta">${money(t.paid)} paid</div></div>`);
    if (!data.items.length) {
      listEl.innerHTML = String(emptyState(`No payroll for ${monthName(month)} yet`, 'Mark attendance, then press “Generate payroll”.'));
      return;
    }
    listEl.innerHTML = String(html`<div class="table-wrap"><table class="table"><thead><tr><th>Employee</th><th>Attendance</th><th class="num">Gross</th><th class="num">Deductions</th><th class="num">Bonus</th><th class="num">Net pay</th><th>Status</th></tr></thead><tbody>
      ${data.items.map(
        (p, i) => html`<tr class="is-clickable" tabindex="0" data-i="${i}">
          <td class="td-main" data-label="Employee"><strong>${p.staff?.name}</strong> <small class="muted">${p.staff?.employeeId} · ${p.staff?.designation || ''}</small></td>
          <td data-label="Attendance"><small>${p.present}P · ${p.halfDay}H · ${p.absent}A · ${p.paidLeave + p.holiday}L/Hol · ${p.unpaidLeave}UL</small></td>
          <td class="num" data-label="Gross">${money(p.grossSalary)}</td>
          <td class="num" data-label="Deductions">${money(deductionsOf(p))}</td>
          <td class="num" data-label="Bonus">${money(p.bonus)}</td>
          <td class="num" data-label="Net pay"><strong>${money(p.netPay)}</strong></td>
          <td data-label="Status">${badge(p.status)}</td></tr>`
      )}</tbody></table></div>`);
  }

  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-i]');
    if (row) payslipDialog(data.items[row.dataset.i], load);
  });
  listEl.addEventListener('keydown', (e) => {
    const row = e.target.closest('tr[data-i]');
    if (row && e.key === 'Enter') payslipDialog(data.items[row.dataset.i], load);
  });
  $('[data-month]', view).addEventListener('change', (e) => e.target.value && ((month = e.target.value), load()));

  gen.addEventListener('click', () =>
    withLoading(gen, async () => {
      try {
        const r = await api('/payroll/generate', { method: 'POST', body: { month } });
        toast(`${r.generated} payslip(s) generated for ${monthName(month)}`, 'success');
        load();
      } catch (err) {
        toastError(err);
      }
    })
  );
  csv.addEventListener('click', () => {
    if (!data?.items.length) return toast('Nothing to export for this month', 'error');
    downloadCSV(`salary-report-${month}.csv`, [
      ['Employee ID', 'Name', 'Designation', 'Days', 'Present', 'Half day', 'Absent', 'Paid leave', 'Unpaid leave', 'Holiday', 'Basic', 'Allowances', 'Gross', 'Absence deduction', 'Fixed deductions', 'Other deductions', 'Bonus', 'Net pay', 'Status', 'Paid on', 'Method', 'Bank', 'Account', 'IFSC'],
      ...data.items.map((p) => [
        p.staff?.employeeId, p.staff?.name, p.staff?.designation, p.daysInMonth, p.present, p.halfDay, p.absent, p.paidLeave, p.unpaidLeave, p.holiday,
        p.baseSalary, p.allowances, p.grossSalary, p.absenceDeduction, p.fixedDeductions, p.otherDeductions, p.bonus, p.netPay, p.status,
        p.paidOn ? fmtDate(p.paidOn) : '', p.paymentMethod, p.staff?.bankName, p.staff?.accountNo, p.staff?.ifsc,
      ]),
      [],
      ['', 'TOTAL', '', '', '', '', '', '', '', '', '', '', data.totals.gross, '', '', '', data.totals.bonus, data.totals.net],
    ]);
  });
  print.addEventListener('click', () => {
    if (!data?.items.length) return toast('Nothing to print for this month', 'error');
    printHTML(html`<div class="head"><div><h1>${SHOP.name}</h1><div>Salary report · ${monthName(month)}</div></div><div>Printed ${fmtDate(new Date())}</div></div>
      <table><thead><tr><th>Emp ID</th><th>Name</th><th class="r">P</th><th class="r">H</th><th class="r">A</th><th class="r">Gross</th><th class="r">Deductions</th><th class="r">Bonus</th><th class="r">Net pay</th><th>Status</th></tr></thead><tbody>
      ${data.items.map((p) => html`<tr><td>${p.staff?.employeeId}</td><td>${p.staff?.name}</td><td class="r">${p.present}</td><td class="r">${p.halfDay}</td><td class="r">${p.absent}</td><td class="r">${money(p.grossSalary)}</td><td class="r">${money(deductionsOf(p))}</td><td class="r">${money(p.bonus)}</td><td class="r">${money(p.netPay)}</td><td>${p.status}</td></tr>`)}
      <tr><th colspan="5">Total</th><th class="r">${money(data.totals.gross)}</th><th class="r">${money(data.totals.deductions)}</th><th class="r">${money(data.totals.bonus)}</th><th class="r">${money(data.totals.net)}</th><th></th></tr>
      </tbody></table>`);
  });

  load();
}

