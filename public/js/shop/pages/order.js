import { $, html, render, api, auth, icon, money, titleCase, fmtDate, statusBadge, loginUrl, pay, toast, withLoading, reorder } from '../lib.js';

const FLOW = ['confirmed', 'packed', 'out-for-delivery', 'delivered'];

export default async function orderPage(view, { args, params, config }) {
  if (!(await auth.ready)) return location.replace(loginUrl());
  const o = await api(`/my/orders/${args[0]}`, { auth: true });
  const step = FLOW.indexOf(o.status);
  const unpaid = o.status === 'awaiting-payment';
  render(
    view,
    html`<div class="wrap" style="max-width:820px">
      <div class="page-head"><div class="crumbs"><a href="#/account/orders">My orders</a>›<span>${o.orderNo}</span></div>
        <h1 class="page-title">Order ${o.orderNo}</h1><p class="muted" style="margin:4px 0 0">Placed on ${fmtDate(o.createdAt)}</p></div>
      ${params.paid && !unpaid ? html`<div class="notice notice--ok">${icon('check')}<span><strong>Thank you! Your payment was successful.</strong> We're preparing your order and will call you if anything is needed.</span></div>` : ''}
      ${unpaid ? html`<div class="notice notice--info">${icon('info')}<span><strong>Payment pending.</strong> Your order will be confirmed once payment is complete.</span></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px"><button class="sbtn sbtn--primary" type="button" data-pay>${icon('lock')}Pay ${money(o.total)}</button><button class="sbtn sbtn--ghost" type="button" data-cancel>Cancel order</button></div>` : ''}
      <div class="scard">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px"><strong>Status</strong>${statusBadge(o.status)}</div>
        ${step >= 0 ? html`<div class="steps">${FLOW.map((s, i) => html`<div class="${i <= step ? 'is-done' : ''}">${['Confirmed', 'Packed', 'On the way', 'Delivered'][i]}</div>`)}</div>` : ''}
        ${o.items.map((i) => html`<div class="sumrow"><span>${titleCase(i.name)} × ${i.quantity}</span><span>${money(i.total)}</span></div>`)}
        <div class="sumrow"><span>Delivery</span><span>Free</span></div>
        <div class="sumrow sumrow--total"><span>Total</span><span>${money(o.total)}</span></div>
        <p class="muted" style="font-size:.8rem;margin:8px 0 0">Payment: ${o.paymentStatus === 'paid' ? 'Paid online' : o.paymentStatus === 'refunded' ? 'Refunded' : 'Not paid yet'}</p>
      </div>
      ${!unpaid ? html`<button class="sbtn sbtn--outline sbtn--block" type="button" data-reorder style="margin-bottom:14px">${icon('cart')}Order these items again</button>` : ''}
      <div class="scard"><h2 class="scard__title">Delivery to</h2><p style="margin:0;font-size:.9rem;line-height:1.5"><strong>${o.customer?.name}</strong> · ${o.customer?.phone}<br />${o.customer?.address}</p></div>
      <p class="muted" style="font-size:.84rem">Questions about this order? Call <a href="tel:+91${config.phone}" style="color:var(--brand-600);font-weight:600">${config.phone}</a>.</p>
    </div>`
  );
  $('[data-pay]', view)?.addEventListener('click', (e) =>
    withLoading(e.currentTarget, async () => {
      try {
        const res = await api(`/my/orders/${o._id}/pay`, { method: 'POST', auth: true });
        if (await pay(res.payment)) location.hash = `#/order/${o._id}?paid=1&t=${Date.now()}`;
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
  $('[data-reorder]', view)?.addEventListener('click', (e) => withLoading(e.currentTarget, () => reorder(o).catch((err) => toast(err.message, 'error'))));
  $('[data-cancel]', view)?.addEventListener('click', async () => {
    if (!confirm('Cancel this order?')) return;
    try {
      await api(`/my/orders/${o._id}/cancel`, { method: 'POST', auth: true });
      toast('Order cancelled');
      location.hash = `#/order/${o._id}?t=${Date.now()}`;
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
