const router = require('express').Router();
const Admin = require('../models/Admin');
const { hashPassword, comparePassword } = require('../utils/password');
const { body, validationResult } = require('express-validator');
const adminAuth = require('../middleware/adminAuth');

const updateValidation = [
  body('fullName').optional().trim().isLength({ max: 100 }).withMessage('Ad maksimum 100 simvol ola bilər'),
  body('email').optional().trim().matches(/^[\w.+-]+@[\w-]+\.[\w.-]+$/).withMessage('E-poçt formatı yanlışdır').normalizeEmail(),
];

const passwordValidation = [
  body('currentPassword').notEmpty().withMessage('Cari şifrə tələb olunur'),
  body('newPassword').isLength({ min: 6 }).withMessage('Yeni şifrə minimum 6 simvol olmalıdır'),
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
    const admin = await Admin.findById(req.adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin tapılmadı' });
    }
    res.json({
      success: true,
      admin: {
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/', adminAuth, updateValidation, handleValidation, async (req, res, next) => {
  try {
    const { fullName, email } = req.body;
    const update = {};
    if (fullName !== undefined) update.fullName = fullName;
    if (email !== undefined) update.email = email;

    const admin = await Admin.findByIdAndUpdate(req.adminId, update, { new: true });
    res.json({
      success: true,
      admin: { _id: admin._id, username: admin.username, email: admin.email, fullName: admin.fullName },
      message: 'Profil yeniləndi',
    });
  } catch (err) {
    next(err);
  }
});

router.put('/password', adminAuth, passwordValidation, handleValidation, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.adminId).select('+password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin tapılmadı' });
    }

    const match = await comparePassword(currentPassword, admin.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Cari şifrə yanlışdır' });
    }

    admin.password = await hashPassword(newPassword);
    await admin.save();

    res.json({ success: true, message: 'Şifrə uğurla dəyişdirildi' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
