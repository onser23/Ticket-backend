const router = require('express').Router();
const Comment = require('../models/Comment');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Admin = require('../models/Admin');
const authOrAdmin = require('../middleware/authOrAdmin');
const { body, validationResult } = require('express-validator');

const commentValidation = [
  body('text').trim().isLength({ min: 1, max: 2000 }).withMessage('Şərh 1-2000 simvol aralığında olmalıdır'),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validasiya xətası',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

router.get('/ticket/:ticketId', authOrAdmin, async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Müraciət tapılmadı' });
    }

    const isOwner = ticket.createdBy.toString() === req.userId;
    const isAdmin = req.userRole === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Bu müraciətə baxmaq hüququnuz yoxdur' });
    }

    const comments = await Comment.find({ ticketId: req.params.ticketId }).sort({ createdAt: 1 });

    const populatedComments = await Promise.all(
      comments.map(async (c) => {
        const obj = c.toObject();
        if (c.authorRole === 'user') {
          const user = await User.findById(c.authorId).select('firstName lastName email');
          obj.authorId = user;
        } else {
          const admin = await Admin.findById(c.authorId).select('username fullName email');
          obj.authorId = admin;
        }
        return obj;
      })
    );

    res.json({ success: true, data: populatedComments });
  } catch (err) {
    next(err);
  }
});

router.post('/ticket/:ticketId', authOrAdmin, commentValidation, handleValidation, async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId).populate('createdBy', 'firstName lastName email');
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Müraciət tapılmadı' });
    }

    const isOwner = ticket.createdBy._id.toString() === req.userId;
    const isAdmin = req.userRole === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Bu müraciətə şərh yazmaq hüququnuz yoxdur' });
    }

    const authorId = isAdmin ? req.adminId : req.userId;

    const comment = await Comment.create({
      ticketId: req.params.ticketId,
      authorId,
      authorRole: req.userRole,
      text: req.body.text.trim(),
    });

    const obj = comment.toObject();
    if (req.userRole === 'user') {
      const user = await User.findById(authorId).select('firstName lastName email');
      obj.authorId = user;
    } else {
      const admin = await Admin.findById(authorId).select('username fullName email');
      obj.authorId = admin;
    }

    if (isAdmin && ticket.createdBy?.email) {
      const { sendAdminReplyEmail } = require('../services/emailService');
      sendAdminReplyEmail({
        to: ticket.createdBy.email,
        firstName: ticket.createdBy.firstName,
        ticket: ticket.toObject(),
        commentText: req.body.text.trim(),
      });
    }

    res.status(201).json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
