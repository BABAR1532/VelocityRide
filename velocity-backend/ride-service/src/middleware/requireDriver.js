'use strict';

module.exports = function requireDriver(req, res, next) {
  if (req.userRole !== 'driver') {
    return res.status(403).json({ error: 'This action is only available to driver accounts' });
  }
  next();
};
