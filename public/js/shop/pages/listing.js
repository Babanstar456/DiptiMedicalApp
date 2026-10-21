import { $, html, render, api, productCard, bindProductActions, titleCase, skeletonGrid, emptyState, qs, icon } from '../lib.js';

// Search results, category, health condition and bestsellers all share this page.
export default async function listing(view, { params, args, config, categories, path }) {
  const state = {
    q: params.q || '',
    category: path.startsWith('/category/') ? args[0] : params.category || '',
    condition: path.startsWith('/condition/') ? args[0] : '',
    featured: params.featured === '1' ? '1' : '',
    inStock: params.inStock === '1' ? '1' : '',
    sort: params.sort || 'relevance',
    page: 1,
  };
  const products = [];
  const heading = state.q ? `Results for “${state.q}”` : state.featured ? 'Bestsellers' : 'All products';

  render(
    view,
    html`<div class="wrap">
      <div class="page-head">
        <div class="crumbs"><a href="#/">Home</a>›<a href="#/categories">Categories</a>›<span data-crumb>${heading}</span></div>
        <h1 class="page-title" data-title>${heading}</h1>
      </div>
      ${!state.q && !state.condition && categories.length
        ? html`<div class="chipbar">${[{ _id: '', name: 'All' }, ...categories].map(
            (c) => html`<a class="chip ${state.category === c._id ? 'is-active' : ''}" href="${c._id ? `#/category/${c._id}` : '#/search'}">${titleCase(c.name)}</a>`
          )}</div>`
        : ''}
      <div class="listbar">
        <span class="count-text" data-count></span>
        <label class="toggle"><input type="checkbox" data-instock ${state.inStock ? 'checked' : ''} />In stock</label>
        <label class="sr-only" for="sort">Sort</label>
        <select class="sselect" id="sort" data-sort>
          <option value="relevance">Relevance</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name">Name A–Z</option>
        </select>
      </div>
      <div data-results>${skeletonGrid()}</div>
      <div class="load-more" data-more></div>
    </div>`
  );
  $('[data-sort]', view).value = state.sort;

  const results = $('[data-results]', view);
  const more = $('[data-more]', view);
  bindProductActions(view, products, config.phone);

  async function load(reset) {
    if (reset) {
      state.page = 1;
      products.length = 0;
      render(results, skeletonGrid());
    }
    const r = await api(`/products?${qs({ q: state.q, category: state.category, condition: state.condition, featured: state.featured, inStock: state.inStock, sort: state.sort, page: state.page })}`);
    products.push(...r.items);
    if (r.title) {
      $('[data-title]', view).textContent = titleCase(r.title);
      $('[data-crumb]', view).textContent = titleCase(r.title);
      document.title = `${titleCase(r.title)} · Dipti Medical`;
    }
    $('[data-count]', view).textContent = `${r.total.toLocaleString('en-IN')} product${r.total === 1 ? '' : 's'}`;
    if (!products.length) {
      render(results, emptyState('No products found', state.q ? 'Try another name, or search by the salt (e.g. paracetamol).' : 'Nothing here yet.', html`<a class="sbtn sbtn--outline" href="tel:+91${config.phone}">${icon('phone')}Call ${config.phone} to order</a>`));
    } else {
      render(results, html`<div class="pgrid">${products.map((p) => productCard(p, config.phone))}</div>`);
    }
    render(more, r.page < r.pages ? html`<button class="sbtn sbtn--outline" type="button" data-load>Load more products</button>` : '');
  }

  more.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-load]');
    if (!b) return;
    b.classList.add('is-loading');
    state.page += 1;
    await load(false);
  });
  $('[data-sort]', view).addEventListener('change', (e) => ((state.sort = e.target.value), load(true)));
  $('[data-instock]', view).addEventListener('change', (e) => ((state.inStock = e.target.checked ? '1' : ''), load(true)));
  await load(true);
}
