const { crudRouter } = require('../../utils/crud');
const Category = require('../../models/Category');
const ProductType = require('../../models/ProductType');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const StockMovement = require('../../models/StockMovement');

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

const products = crudRouter(Product, {
  search: ['name', 'sku', 'barcode', 'composition', 'manufacturer'],
  filters: ['category', 'type', 'isActive', 'prescriptionRequired'],
  populate: [
    { path: 'category', select: 'name' },
    { path: 'type', select: 'name unit' },
  ],
  sort: 'name',
  readOnly: ['stock'], // stock only changes through Inventory / Orders so every change is logged
  buildQuery: (query, req) => {
    if (req.query.stock === 'low') query.$expr = { $lte: ['$stock', '$reorderLevel'] };
    if (req.query.stock === 'out') query.stock = { $lte: 0 };
  },
  beforeCreate: (data, req) => {
    data.stock = Math.max(0, Number(req.body.openingStock) || 0);
    delete data.openingStock;
  },
  afterCreate: async (doc, req) => {
    if (doc.stock > 0) {
      await StockMovement.create({
        product: doc._id,
        type: 'purchase',
        quantity: doc.stock,
        balanceAfter: doc.stock,
        batchNo: doc.batchNo,
        expiryDate: doc.expiryDate,
        unitCost: doc.costPrice,
        note: 'Opening stock',
        by: req.user._id,
      });
    }
  },
  canDelete: async (id) =>
    (await Order.exists({ 'items.product': id })) && 'This product appears in orders. Deactivate it instead of deleting.',
});

module.exports = { categories, types, products };
