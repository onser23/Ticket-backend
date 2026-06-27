const router = require('express').Router();
const Company = require('../models/Company');
const User = require('../models/User');
const adminAuth = require('../middleware/adminAuth');
const { body, validationResult } = require('express-validator');

const updateValidation = [
  body('displayName').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Şirkət adı 2-100 simvol aralığında olmalıdır'),
  body('contactEmail').optional({ nullable: true, checkFalsy: true }).trim().matches(/^[\w.+-]+@[\w-]+\.[\w.-]+$/).withMessage('E-poçt formatı yanlışdır'),
  body('contactPhone').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 30 }).withMessage('Telefon maksimum 30 simvol ola bilər'),
  body('isActive').optional().isBoolean().withMessage('isActive boolean olmalıdır'),
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

router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search && search.trim()) {
      query.$or = [
        { displayName: new RegExp(search.trim(), 'i') },
        { originalName: new RegExp(search.trim(), 'i') },
        { contactEmail: new RegExp(search.trim(), 'i') },
      ];
    }

    if (status === 'active') query.isActive = true;
    else if (status === 'passive') query.isActive = false;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [total, companies] = await Promise.all([
      Company.countDocuments(query),
      Company.find(query)
        .populate('ownerUserId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
    ]);

    res.json({
      success: true,
      data: companies,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', adminAuth, async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id).populate('ownerUserId', 'firstName lastName email');
    if (!company) {
      return res.status(404).json({ success: false, message: 'Şirkət tapılmadı' });
    }
    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', adminAuth, updateValidation, handleValidation, async (req, res, next) => {
  try {
    const { displayName, contactEmail, contactPhone, isActive } = req.body;
    const update = {};
    if (displayName !== undefined) update.displayName = displayName;
    if (contactEmail !== undefined) update.contactEmail = contactEmail || null;
    if (contactPhone !== undefined) update.contactPhone = contactPhone || null;
    if (isActive !== undefined) update.isActive = isActive;

    const company = await Company.findByIdAndUpdate(req.params.id, update, { new: true }).populate('ownerUserId', 'firstName lastName email');
    if (!company) {
      return res.status(404).json({ success: false, message: 'Şirkət tapılmadı' });
    }

    if (displayName !== undefined) {
      await User.updateMany({ companyId: company._id }, { companyName: displayName });
    }

    res.json({ success: true, data: company, message: 'Şirkət yeniləndi' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Şirkət tapılmadı' });
    }
    res.json({ success: true, message: 'Şirkət deaktiv edildi' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
