const { crudRouter, escapeRegex } = require('../../utils/crud');
const Category = require('../../models/Category');
const ProductType = require('../../models/ProductType');
const Product = require('../../models/Product');
const Order = require('../../models/Order');

const categories = crudRouter(Category, {
  search: ['name', 'description'],
  filters: ['isActive'],
  sort: 'sortOrder name',
  canDelete: async (id) =>
    (await Product.exists({ category: id })) && 'This category has products. Move them or deactivate the category instead.',
});

const types = crudRouter(ProductType, {
  search: ['name'],
  filters: ['isActive'],
  sort: 'name',
  canDelete: async (id) =>
    (await Product.exists({ type: id })) && 'Products use this type. Change them or deactivate the type instead.',
});

// Finds a category/type by name (any letter case) or creates it, so the product form can take plain names.
async function findOrCreate(Model, name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const existing = await Model.findOne({ name: new RegExp(`^${escapeRegex(clean)}$`, 'i') }).select('_id');
  return existing ? existing._id : (await Model.create({ name: clean }))._id;
}

const products = crudRouter(Product, {
  search: ['name', 'sku', 'barcode', 'composition', 'manufacturer'],
  filters: ['category', 'type', 'isActive', 'inStock', 'prescriptionRequired'],
  populate: [
    { path: 'category', select: 'name' },
    { path: 'type', select: 'name unit' },
  ],
  sort: 'name',
  buildQuery: (query, req) => {
    if (req.query.price === 'missing') query.price = { $lte: 0 };
  },
  // The form sends categoryName / typeName; turn them into references, creating new ones when needed.
  beforeSave: async (data) => {
    if ('categoryName' in data) data.category = await findOrCreate(Category, data.categoryName);
    if ('typeName' in data) data.type = await findOrCreate(ProductType, data.typeName);
    delete data.categoryName;
    delete data.typeName;
  },
  canDelete: async (id) =>
    (await Order.exists({ 'items.product': id })) && 'This product appears in orders. Deactivate it instead of deleting.',
});

module.exports = { categories, types, products, findOrCreate };
