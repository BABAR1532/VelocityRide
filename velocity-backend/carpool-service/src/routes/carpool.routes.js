'use strict';

const express  = require('express');
const { body } = require('express-validator');
const ctrl     = require('../controllers/carpool.controller');
const auth     = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.post('/route-estimate', [
  body('from').trim().notEmpty(),
  body('to').trim().notEmpty(),
  body('totalSeats').optional().isInt({ min: 1, max: 6 }),
], ctrl.routeEstimate);

router.get('/pools',                                           ctrl.listPools);
router.get('/pools/my-active',                                 ctrl.getMyActivePool);
router.get('/pools/history',                                   ctrl.getMyHistory);
router.get('/pools/:id',                                       ctrl.getPool);
router.post('/pools', [
  body('from').trim().notEmpty(),
  body('to').trim().notEmpty(),
  body('departureTime').isISO8601().toDate(),
  body('totalSeats').isInt({ min: 1, max: 6 }),
  body('farePerPerson').isFloat({ min: 0 }),
], ctrl.createPool);

router.post('/pools/:id/join',          ctrl.joinPool);
router.post('/pools/:id/driver-accept', ctrl.driverAcceptPool);
router.post('/pools/:id/request-driver',ctrl.requestDriver);
router.patch('/pools/:id/start',        ctrl.startPool);
router.patch('/pools/:id/complete',     ctrl.completePool);
router.patch('/pools/:id/cancel',       ctrl.cancelPoolByDriver);
router.get('/driver/jobs',              ctrl.getDriverJobs);
router.delete('/pools/:id/leave', ctrl.leavePool);
router.delete('/pools/:id',       ctrl.deletePool);

module.exports = router;
