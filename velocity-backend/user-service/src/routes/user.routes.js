'use strict';

const express  = require('express');
const { body } = require('express-validator');
const ctrl     = require('../controllers/user.controller');
const auth     = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.use(auth);

router.get('/me',                                                    ctrl.getProfile);
router.put('/me', [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
],                                                                   ctrl.updateProfile);
router.get('/me/locations',                                          ctrl.getLocations);
router.post('/me/locations', [
  body('label').trim().notEmpty().withMessage('Label is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
],                                                                   ctrl.addLocation);
router.delete('/me/locations/:locationId',                           ctrl.deleteLocation);

module.exports = router;
