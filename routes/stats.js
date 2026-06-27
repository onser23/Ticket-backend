const router = require('express').Router();
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// GET /api/stats/user — own ticket counts by status
router.get('/user', auth, async (req, res, next) => {
  try {
    const stats = await Ticket.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(req.userId), isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result = { total: 0, pending: 0, in_progress: 0, resolved: 0 };
    for (const s of stats) {
      result[s._id] = s.count;
      result.total += s.count;
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/admin — all tickets counts + byCompany
router.get('/admin', adminAuth, async (req, res, next) => {
  try {
    const stats = await Ticket.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result = { total: 0, pending: 0, in_progress: 0, resolved: 0 };
    for (const s of stats) {
      result[s._id] = s.count;
      result.total += s.count;
    }

    // By company
    const byCompany = await Ticket.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$companyId',
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: 'companies',
          localField: '_id',
          foreignField: '_id',
          as: 'company',
        },
      },
      { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          companyId: '$_id',
          displayName: { $ifNull: ['$company.displayName', '(Silinmiş şirkət)'] },
          total: 1, pending: 1, in_progress: 1, resolved: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({ success: true, data: { ...result, byCompany } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
