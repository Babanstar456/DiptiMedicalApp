import { html, raw, api, money, num, fmtTime, fmtDateTime, badge, setPage, skeleton, emptyState, button } from '../core.js';

const QUICK = [
  ['#/orders?new=1', 'New sale', 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z'],
  ['#/products?new=1', 'Add product', 'M20 2H4v4h16V2zM5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5zm10 5H9v-2h6v2z'],
  ['#/appointments?new=1', 'Book appointment', 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11z'],
  ['#/inventory?adjust=1', 'Stock in / out', 'M16 6l2.3 2.3-4.9 4.9-4-4L2 16.6 3.4 18l6-6 4 4 6.3-6.3L22 12V6z'],
];

// Single-series column chart: one brand color, 4px rounded tops on a shared baseline, hover/focus tooltip, table for screen readers.
function salesChart(days) {
  const max = Math.max(...days.map((d) => d.amount), 1);
  const dayName = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
  return html`
    <div class="chart">
      <div class="chart__plot" aria-hidden="true">
        ${days.map((d, i) => {
          const h = Math.max(1, (d.amount / max) * 100);
          const last = i === days.length - 1;
          return html`<button type="button" class="chart__col" tabindex="0">
            <span class="chart__tip">${dayName(d.date)} ${d.date.slice(8)}: ${money(d.amount)}</span>
            ${last ? html`<span class="chart__val" style="bottom:calc(${h}% + 4px)">${money(d.amount)}</span>` : ''}
            <span class="chart__bar" style="height:${h}%"></span>
          </button>`;
        })}
      </div>
      <div class="chart__axis" aria-hidden="true">${days.map((d, i) => html`<span>${i === days.length - 1 ? 'Today' : dayName(d.date)}</span>`)}</div>
      <table class="sr-only"><caption>Sales, last 7 days</caption><tbody>${days.map((d) => html`<tr><th>${d.date}</th><td>${money(d.amount)}</td></tr>`)}</tbody></table>
    </div>`;
}

export default async function dashboard(view, params, me) {
  setPage('Dashboard', [button('Refresh', { iconName: 'refresh', title: 'Refresh', onClick: () => dashboard(view, params, me) })]);
  view.innerHTML = String(skeleton(6));
  let d;
  try {
    d = await api('/dashboard');
  } catch (err) {
    view.innerHTML = String(emptyState('Could not load dashboard', err.message));
    return;
  }
  const hello = (me.displayName || '').split(' ')[0];

  view.innerHTML = String(html`
    <p class="muted" style="margin:0 0 12px">${hello ? `Hello ${hello} · ` : ''}${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <div class="tiles">
      <a class="tile" href="#/orders"><div class="tile__label">Today's sales</div><div class="tile__value">${money(d.sales.today.amount)}</div><div class="tile__meta">${num(d.sales.today.count)} orders</div></a>
      <a class="tile" href="#/orders"><div class="tile__label">This month</div><div class="tile__value">${money(d.sales.month.amount)}</div><div class="tile__meta">${num(d.sales.month.count)} orders</div></a>
      <a class="tile ${d.openOrders ? 'tile--warn' : ''}" href="#/orders?status=open"><div class="tile__label">Open orders</div><div class="tile__value">${num(d.openOrders)}</div><div class="tile__meta">to pack / deliver</div></a>
      <a class="tile" href="#/appointments"><div class="tile__label">Appointments today</div><div class="tile__value">${num(d.appointments.today)}</div><div class="tile__meta">booked</div></a>
      <a class="tile ${d.inventory.lowStock ? 'tile--alert' : ''}" href="#/inventory"><div class="tile__label">Low stock</div><div class="tile__value">${num(d.inventory.lowStock)}</div><div class="tile__meta">at or below reorder level</div></a>
      <a class="tile ${d.inventory.expiring ? 'tile--warn' : ''}" href="#/inventory?tab=expiring"><div class="tile__label">Expiring ≤ 90 days</div><div class="tile__value">${num(d.inventory.expiring)}</div><div class="tile__meta">products in stock</div></a>
      <a class="tile" href="#/products"><div class="tile__label">Active products</div><div class="tile__value">${num(d.inventory.products)}</div><div class="tile__meta">in catalog</div></a>
      ${me.role === 'admin'
        ? html`<a class="tile" href="#/attendance"><div class="tile__label">Staff present</div><div class="tile__value">${num(d.staff.presentToday)} / ${num(d.staff.total)}</div><div class="tile__meta">today</div></a>`
        : ''}
    </div>

    <div class="panel" style="margin-bottom:16px"><div class="quick">${QUICK.map(
      ([href, text, path]) => html`<a href="${href}">${raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`)}${text}</a>`
    )}</div></div>

    <div class="grid-2">
      <section class="panel">
        <div class="panel__head"><div><h2 class="panel__title">Sales, last 7 days</h2><p class="panel__sub">Excludes cancelled orders</p></div></div>
        ${salesChart(d.sales.last7Days)}
      </section>
      <section class="panel">
        <div class="panel__head"><h2 class="panel__title">Today's appointments</h2><a class="b b--sm" href="#/appointments">View all</a></div>
        ${d.appointments.upcoming.length
          ? html`<div class="list">${d.appointments.upcoming.map(
              (a) => html`<div class="list__item"><div class="list__main"><strong>${a.patientName}</strong><small>${a.doctor?.name || ''}</small></div><div class="list__end">${fmtTime(a.time)}<br />${badge(a.status)}</div></div>`
            )}</div>`
          : emptyState('No upcoming appointments today')}
      </section>
    </div>

    <section class="panel" style="margin-top:16px">
      <div class="panel__head"><h2 class="panel__title">Recent orders</h2><a class="b b--sm" href="#/orders">View all</a></div>
      ${d.recentOrders.length
        ? html`<div class="list">${d.recentOrders.map(
            (o) => html`<a class="list__item" href="#/orders?open=${o._id}"><div class="list__main"><strong>${o.orderNo} · ${o.customer?.name || 'Walk-in'}</strong><small>${fmtDateTime(o.createdAt)}</small></div><div class="list__end"><strong>${money(o.total)}</strong><br />${badge(o.status)}</div></a>`
          )}</div>`
        : emptyState('No orders yet', 'Create your first sale from “New sale”.')}
    </section>`);
}
