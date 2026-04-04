'use strict';

const express = require('express');
const ctrl = require('../controllers/driver.controller');

const router = express.Router();

router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);
router.get('/dashboard', ctrl.getDashboard);
router.get('/jobs', ctrl.getJobs);
router.get('/history', ctrl.getHistory);
router.post('/jobs/:type/:id/accept', ctrl.acceptJob);
router.patch('/jobs/:type/:id/start', ctrl.startJob);
router.patch('/jobs/:type/:id/complete', ctrl.completeJob);
router.patch('/jobs/:type/:id/cancel', ctrl.cancelJob);

module.exports = router;
