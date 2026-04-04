'use strict';
const express  = require('express');
const { body } = require('express-validator');
const ctrl  = require('../controllers/parcel.controller');
const auth  = require('../middleware/auth');
const requireDriver = require('../middleware/requireDriver');
const router = express.Router();
router.use(auth);

router.get('/available', requireDriver, ctrl.listAvailableParcels);
router.get('/driver/jobs', requireDriver, ctrl.listDriverParcels);
router.get('/driver/history', requireDriver, ctrl.driverParcelHistory);
router.get('/driver/earnings-summary', requireDriver, ctrl.driverParcelEarnings);

router.post('/estimate', [
  body('pickupAddress').trim().notEmpty(),
  body('dropoffAddress').trim().notEmpty(),
  body('weight').isFloat({ min: 0.1 }),
], ctrl.estimate);

router.post('/', [
  body('pickupAddress').trim().notEmpty(),
  body('dropoffAddress').trim().notEmpty(),
  body('weight').isFloat({ min: 0.1 }),
  body('packageType').isIn(['documents','electronics','food','clothing','other']),
], ctrl.book);

router.get('/',          ctrl.listParcels);
router.post('/:id/claim', requireDriver, ctrl.claimParcel);
router.get('/:id',       ctrl.getParcel);
router.patch('/:id/status', [
  body('status').isIn(['picked_up','in_transit','out_for_delivery','delivered','cancelled']),
], ctrl.updateStatus);

module.exports = router;
