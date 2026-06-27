const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Otp = require('../models/Otp');
const Company = require('../models/Company');
const { hashPassword, comparePassword } = require('../utils/password');
const { signUserToken } = require('../utils/jwt');
const {
  generateOtp, hashOtp, compareOtp, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, OTP_MAX_ATTEMPTS,
} = require('../utils/otp');
const { sendOtpEmail } = require('../services/emailService');
const auth = require('../middleware/auth');
const {
  registerValidation, loginValidation, verifyOtpValidation,
  resendOtpValidation, forgotPasswordValidation, resetPasswordValidation,
  handleValidation,
} = require('../utils/validators');

// POST /api/auth/register (atomic User + Company transaction)
router.post('/register', registerValidation, handleValidation, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { firstName, lastName, email, password, companyName } = req.body;

    const existing = await User.findOne({ email }).session(session);
    if (existing) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Bu e-poçt ilə istifadəçi artıq mövcuddur' });
    }

    const hashed = await hashPassword(password);

    // 1. User yarat (companyId=null, sonra set olunacaq)
    const [user] = await User.create([{
      firstName, lastName, email, password: hashed, companyName,
    }], { session });

    // 2. Company yarat (ownerUserId = user._id)
    const [company] = await Company.create([{
      displayName: companyName,
      originalName: companyName,
      ownerUserId: user._id,
    }], { session });

    // 3. User.companyId set et
    user.companyId = company._id;
    await user.save({ session });

    // 4. OTP yarat
    const code = generateOtp();
    const hashedCode = await hashOtp(code);
    await Otp.create([{
      email: user.email,
      code: hashedCode,
      purpose: 'register',
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    }], { session });

    await session.commitTransaction();
    session.endSession();

    sendOtpEmail({
      to: user.email,
      firstName: user.firstName,
      code,
      purpose: 'register',
    });

    res.status(201).json({
      success: true,
      message: 'Qeydiyyat uğurla başa çatdı. Email ünvanınıza göndərilmiş OTP kodunu daxil edin.',
      email: user.email,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', verifyOtpValidation, handleValidation, async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const otp = await Otp.findOne({ email, purpose: 'register', isUsed: false }).sort({ createdAt: -1 });
    if (!otp) {
      return res.status(400).json({ success: false, message: 'OTP tapılmadı və ya artıq istifadə olunub' });
    }
    if (otp.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP-nin vaxtı keçib' });
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Çoxlu yanlış cəhd. Yeni OTP tələb edin.' });
    }

    const match = await compareOtp(code, otp.code);
    if (!match) {
      otp.attempts += 1;
      await otp.save();
      return res.status(400).json({ success: false, message: 'OTP yanlışdır' });
    }

    otp.isUsed = true;
    await otp.save();

    await User.updateOne({ email }, { isVerified: true });

    res.json({ success: true, message: 'Email uğurla təsdiqləndi. İndi login ola bilərsiniz.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', resendOtpValidation, handleValidation, async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email artıq təsdiqlənib' });
    }

    const lastOtp = await Otp.findOne({ email, purpose: 'register' }).sort({ createdAt: -1 });
    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - lastOtp.createdAt.getTime())) / 1000);
      return res.status(429).json({ success: false, message: `Yeni OTP üçün ${waitSec} saniyə gözləyin` });
    }

    await Otp.updateMany({ email, purpose: 'register', isUsed: false }, { isUsed: true });

    const code = generateOtp();
    const hashedCode = await hashOtp(code);
    await Otp.create({
      email: user.email,
      code: hashedCode,
      purpose: 'register',
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    sendOtpEmail({
      to: user.email,
      firstName: user.firstName,
      code,
      purpose: 'register',
    });

    res.json({ success: true, message: 'Yeni OTP email ünvanınıza göndərildi' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', loginValidation, handleValidation, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'E-poçt və ya şifrə yanlışdır' });
    }
    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Email təsdiqlənməyib. OTP kodunu yoxlayın.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Hesab deaktiv edilib' });
    }

    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'E-poçt və ya şifrə yanlışdır' });
    }

    const token = signUserToken({ userId: user._id.toString() });

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        companyName: user.companyName,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordValidation, handleValidation, async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: true, message: 'Əgər email mövcuddursa, reset kodu göndərildi' });
    }

    const code = generateOtp();
    const hashedCode = await hashOtp(code);
    await Otp.create({
      email: user.email,
      code: hashedCode,
      purpose: 'reset_password',
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    sendOtpEmail({
      to: user.email,
      firstName: user.firstName,
      code,
      purpose: 'reset_password',
    });

    res.json({ success: true, message: 'Əgər email mövcuddursa, reset kodu göndərildi' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', resetPasswordValidation, handleValidation, async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;

    const otp = await Otp.findOne({ email, purpose: 'reset_password', isUsed: false }).sort({ createdAt: -1 });
    if (!otp) {
      return res.status(400).json({ success: false, message: 'OTP tapılmadı və ya artıq istifadə olunub' });
    }
    if (otp.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP-nin vaxtı keçib' });
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Çoxlu yanlış cəhd. Yeni OTP tələb edin.' });
    }

    const match = await compareOtp(code, otp.code);
    if (!match) {
      otp.attempts += 1;
      await otp.save();
      return res.status(400).json({ success: false, message: 'OTP yanlışdır' });
    }

    otp.isUsed = true;
    await otp.save();

    const hashed = await hashPassword(newPassword);
    await User.updateOne({ email }, { password: hashed });

    res.json({ success: true, message: 'Şifrə uğurla dəyişdirildi. İndi login ola bilərsiniz.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
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
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
