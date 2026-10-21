const router = require('express').Router;
const mongoose = require('mongoose');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PROTECTED = ['_id', '__v', 'createdAt', 'updatedAt'];

// Removes fields clients must not set; turns '' into null for references/dates/numbers and
// into "unset" (undefined) for unique strings like SKU, so many blank values don't collide.
function cleanBody(Model, body = {}, readOnly = []) {
  const data = { ...body };
  // Extra (non-schema) keys stay for hooks such as beforeSave; Mongoose drops any that remain.
  [...PROTECTED, ...readOnly].forEach((k) => delete data[k]);
  for (const [key, value] of Object.entries(data)) {
    const path = Model.schema.path(key);
    if (value !== '' || !path) continue;
    if (['ObjectId', 'Date', 'Number'].includes(path.instance)) data[key] = null;
    else if (path.options?.unique) data[key] = undefined;
  }
  return data;
}

// { a: 1, b: undefined } → { $set: { a: 1 }, $unset: { b: 1 } }
function toUpdate(data) {
  const $set = {};
  const $unset = {};
  for (const [k, v] of Object.entries(data)) v === undefined ? ($unset[k] = 1) : ($set[k] = v);
  return Object.keys($unset).length ? { $set, $unset } : { $set };
}

function parseFilterValue(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

/**
 * Standard list/get/create/update/delete routes for a model.
 * GET /?q=&page=&limit=&<filter>=   GET /:id   POST /   PUT /:id   DELETE /:id
 */
function crudRouter(Model, opts = {}) {
  const { search = [], filters = [], populate = '', sort = '-createdAt', readOnly = [] } = opts;
  const { buildQuery, beforeCreate, beforeSave, afterCreate, canDelete } = opts;
  const r = router();

  r.get('/', async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const query = {};
      const q = (req.query.q || '').trim();
      if (q && search.length) query.$or = search.map((f) => ({ [f]: new RegExp(escapeRegex(q), 'i') }));
      for (const f of filters) if (req.query[f] !== undefined && req.query[f] !== '') query[f] = parseFilterValue(req.query[f]);
      if (buildQuery) await buildQuery(query, req);

      const [items, total] = await Promise.all([
        Model.find(query).populate(populate).sort(req.query.sort || sort).skip((page - 1) * limit).limit(limit).lean(),
        Model.countDocuments(query),
      ]);
      res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
    } catch (err) {
      next(err);
    }
  });

  r.get('/:id', async (req, res, next) => {
    try {
      const doc = await Model.findById(req.params.id).populate(populate).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  r.post('/', async (req, res, next) => {
    try {
      const data = cleanBody(Model, req.body, readOnly);
      if (beforeCreate) await beforeCreate(data, req);
      if (beforeSave) await beforeSave(data, req);
      const doc = await Model.create(data);
      if (afterCreate) await afterCreate(doc, req);
      res.status(201).json(await Model.findById(doc._id).populate(populate).lean());
    } catch (err) {
      next(err);
    }
  });

  r.put('/:id', async (req, res, next) => {
    try {
      const data = cleanBody(Model, req.body, readOnly);
      if (beforeSave) await beforeSave(data, req, req.params.id);
      const doc = await Model.findByIdAndUpdate(req.params.id, toUpdate(data), { new: true, runValidators: true }).populate(populate).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  r.delete('/:id', async (req, res, next) => {
    try {
      if (canDelete) {
        const reason = await canDelete(req.params.id);
        if (reason) return res.status(409).json({ error: reason });
      }
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return r;
}

const isId = (v) => mongoose.isValidObjectId(v);

module.exports = { crudRouter, cleanBody, escapeRegex, isId };
