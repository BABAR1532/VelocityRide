'use strict';

const express  = require('express');
const { body } = require('express-validator');
const ctrl     = require('../controllers/subscription.controller');
const auth     = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/plans',    ctrl.getPlans);         // cached
router.post('/', [
  body('planId').isIn(['basic', 'standard', 'premium']).withMessage('Invalid plan'),
], ctrl.subscribe);
router.get('/me',       ctrl.getMySubscription);
router.delete('/me',    ctrl.cancel);

module.exports = router;
