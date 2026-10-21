const { crudRouter } = require('../../utils/crud');
const PrescriptionRequest = require('../../models/PrescriptionRequest');

module.exports = crudRouter(PrescriptionRequest, {
  search: ['requestNo', 'name', 'phone'],
  filters: ['status'],
  populate: { path: 'user', select: 'displayName email' },
  sort: '-createdAt',
  readOnly: ['requestNo', 'user', 'image'],
});
