import { html, render, api, art, titleCase } from '../lib.js';
import { categoryIcon } from './home.js';

export default async function categories(view) {
  const data = await api('/home');
  render(
    view,
    html`<div class="wrap">
      <div class="page-head"><div class="crumbs"><a href="#/">Home</a>›<span>Categories</span></div><h1 class="page-title">Shop by category</h1></div>
      <div class="tiles-grid">${data.categories.map(
        (c) => html`<a class="ctile" href="#/category/${c._id}"><span class="ctile__icon">${c.image ? html`<img src="${c.image}" alt="" />` : art(categoryIcon(c.name))}</span><span><strong>${titleCase(c.name)}</strong><small>${c.productCount} products</small></span></a>`
      )}</div>
      ${data.conditions.length
        ? html`<section class="section"><div class="section__head"><h2 class="section__title">Browse by health condition</h2></div>
          <div class="tiles-grid tiles-grid--5">${data.conditions.map(
            (c) => html`<a class="ctile" href="#/condition/${c.slug}"><span class="ctile__icon">${art(c.icon)}</span><span><strong>${c.name}</strong><small>${c.count} products</small></span></a>`
          )}</div></section>`
        : ''}
    </div>`
  );
}
