const router = require('express').Router();
const Admin = require('../models/Admin');
const { comparePassword } = require('../utils/password');
const { signAdminToken } = require('../utils/jwt');
const adminAuth = require('../middleware/adminAuth');
const { adminLoginValidation, handleValidation } = require('../utils/validators');

// POST /api/admin/auth/login
router.post('/login', adminLoginValidation, handleValidation, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'İstifadəçi adı və ya şifrə yanlışdır' });
    }

    const match = await comparePassword(password, admin.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'İstifadəçi adı və ya şifrə yanlışdır' });
    }

    const token = signAdminToken({ adminId: admin._id.toString() });

    res.json({
      success: true,
      token,
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

// GET /api/admin/auth/me
router.get('/me', adminAuth, async (req, res, next) => {
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

module.exports = router;
