const router = require('express').Router();
const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

const updateValidation = [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Ad 2-50 simvol aralığında olmalıdır'),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Soyad 2-50 simvol aralığında olmalıdır'),
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

router.get('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).populate('companyId', 'displayName isActive');
    if (!user) {
      return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    res.json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        companyName: user.companyName,
        companyId: user.companyId,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/', auth, updateValidation, handleValidation, async (req, res, next) => {
  try {
    const { firstName, lastName, email } = req.body;
    const update = {};
    if (firstName !== undefined) update.firstName = firstName;
    if (lastName !== undefined) update.lastName = lastName;
    if (email !== undefined) {
      const existing = await User.findOne({ email, _id: { $ne: req.userId } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Bu e-poçt artıq istifadə olunur' });
      }
      update.email = email;
    }

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true });
    res.json({
      success: true,
      user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      message: 'Profil yeniləndi',
    });
  } catch (err) {
    next(err);
  }
});

router.put('/password', auth, passwordValidation, handleValidation, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }

    const match = await comparePassword(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Cari şifrə yanlışdır' });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    res.json({ success: true, message: 'Şifrə uğurla dəyişdirildi' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
