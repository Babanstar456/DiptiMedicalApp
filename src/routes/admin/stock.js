const Product = require('../../models/Product');
const StockMovement = require('../../models/StockMovement');

const httpError = (status, message) => Object.assign(new Error(message), { status, expose: true });

/**
 * Changes a product's stock atomically and logs the movement.
 * Removing more than is in stock fails with 409 instead of going negative.
 */
async function changeStock(productId, delta, movement) {
  const filter = { _id: productId };
  if (delta < 0) filter.stock = { $gte: -delta };
  const product = await Product.findOneAndUpdate(filter, { $inc: { stock: delta } }, { new: true });
  if (!product) {
    const exists = await Product.findById(productId).select('name stock');
    if (!exists) throw httpError(404, 'Product not found');
    throw httpError(409, `Not enough stock for ${exists.name} (available: ${exists.stock})`);
  }
  await StockMovement.create({ ...movement, product: product._id, quantity: delta, balanceAfter: product.stock });
  return product;
}

module.exports = { changeStock, httpError };
