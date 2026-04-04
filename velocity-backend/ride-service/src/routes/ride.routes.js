'use strict';

const express  = require('express');
const { body } = require('express-validator');
const ctrl     = require('../controllers/ride.controller');
const auth     = require('../middleware/auth');
const requireDriver = require('../middleware/requireDriver');

const router = express.Router();
router.use(auth);

router.post('/estimate', [
  body('from').trim().notEmpty(),
  body('to').trim().notEmpty(),
  body('type').isIn(['car', 'bike', 'carpool']),
], ctrl.estimate);

router.post('/', [
  body('from').trim().notEmpty(),
  body('to').trim().notEmpty(),
  body('type').isIn(['car', 'bike', 'carpool']),
], ctrl.bookRide);

router.get('/driver/jobs', requireDriver, ctrl.listDriverJobs);
router.get('/driver/history', requireDriver, ctrl.driverHistory);
router.get('/driver/earnings-summary', requireDriver, ctrl.driverEarningsSummary);
router.get('/pending', requireDriver, ctrl.getPendingRides);

router.get('/', ctrl.listRides);

router.post('/:id/accept', requireDriver, ctrl.acceptRide);
router.patch('/:id/start', requireDriver, ctrl.startRide);
router.patch('/:id/complete', requireDriver, ctrl.completeRide);

router.get('/:id', ctrl.getRide);
router.patch('/:id/cancel', ctrl.cancelRide);

module.exports = router;
