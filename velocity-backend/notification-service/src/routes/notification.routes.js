'use strict';

const express      = require('express');
const Notification = require('../models/Notification.model');
const auth         = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /notifications — fetch user's notifications (newest first)
router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification
      .find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
});

// PATCH /notifications/read-all — mark all as read  (must be BEFORE /:id/read)
router.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { $set: { read: true } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

// PATCH /notifications/:id/read — mark one as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { read: true } },
      { new: true },
    );
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: notif });
  } catch (err) { next(err); }
});

module.exports = router;
