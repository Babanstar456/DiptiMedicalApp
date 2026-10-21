const r = require('express').Router();
const requireRole = require('../../middleware/requireRole');
const { categories, types, products } = require('./catalog');
const { doctors, appointments, slots } = require('./clinic');
const { staff, attendance, payroll } = require('./hr');

// Pharmacists run the shop floor; only admins see HR, payroll and user access.
const shop = requireRole('admin', 'pharmacist');
const adminOnly = requireRole('admin');

r.use('/dashboard', shop, require('./dashboard'));
r.use('/uploads', shop, require('./uploads'));
r.use('/categories', shop, categories);
r.use('/types', shop, types);
r.use('/products', shop, products);
r.use('/orders', shop, require('./orders'));
r.use('/doctors', shop, doctors);
r.get('/appointment-slots', shop, slots);
r.use('/appointments', shop, appointments);

r.use('/staff', adminOnly, staff);
r.use('/attendance', adminOnly, attendance);
r.use('/payroll', adminOnly, payroll);
r.use('/users', adminOnly, require('./users'));

module.exports = r;
