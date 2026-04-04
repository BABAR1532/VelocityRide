'use strict';

const express  = require('express');
const { body } = require('express-validator');
const ctrl     = require('../controllers/auth.controller');

const router = express.Router();

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['user', 'driver']).withMessage('role must be user or driver'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

router.post('/register', registerRules, ctrl.register);
router.post('/login',    loginRules,    ctrl.login);
router.post('/refresh',                 ctrl.refresh);
router.post('/logout',                  ctrl.logout);
router.post('/change-password', changePasswordRules, ctrl.changePassword);

module.exports = router;
