const { body, validationResult } = require('express-validator');

const EMAIL_REGEX = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;

const registerValidation = [
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('Ad 2-50 simvol aralığında olmalıdır'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Soyad 2-50 simvol aralığında olmalıdır'),
  body('email').trim().matches(EMAIL_REGEX).withMessage('E-poçt formatı yanlışdır').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Şifrə minimum 6 simvol olmalıdır'),
  body('companyName').trim().isLength({ min: 2, max: 100 }).withMessage('Şirkət adı 2-100 simvol aralığında olmalıdır'),
];

const loginValidation = [
  body('email').trim().matches(EMAIL_REGEX).withMessage('E-poçt formatı yanlışdır').normalizeEmail(),
  body('password').notEmpty().withMessage('Şifrə tələb olunur'),
];

const verifyOtpValidation = [
  body('email').trim().matches(EMAIL_REGEX).withMessage('E-poçt formatı yanlışdır').normalizeEmail(),
  body('code').isLength({ min: 6, max: 6 }).withMessage('OTP 6 rəqəm olmalıdır').isNumeric().withMessage('OTP yalnız rəqəmlərdən ibarət olmalıdır'),
];

const resendOtpValidation = [
  body('email').trim().matches(EMAIL_REGEX).withMessage('E-poçt formatı yanlışdır').normalizeEmail(),
];

const forgotPasswordValidation = [
  body('email').trim().matches(EMAIL_REGEX).withMessage('E-poçt formatı yanlışdır').normalizeEmail(),
];

const resetPasswordValidation = [
  body('email').trim().matches(EMAIL_REGEX).withMessage('E-poçt formatı yanlışdır').normalizeEmail(),
  body('code').isLength({ min: 6, max: 6 }).withMessage('OTP 6 rəqəm olmalıdır').isNumeric().withMessage('OTP yalnız rəqəmlərdən ibarət olmalıdır'),
  body('newPassword').isLength({ min: 6 }).withMessage('Yeni şifrə minimum 6 simvol olmalıdır'),
];

const adminLoginValidation = [
  body('username').trim().notEmpty().withMessage('İstifadəçi adı tələb olunur'),
  body('password').notEmpty().withMessage('Şifrə tələb olunur'),
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

module.exports = {
  EMAIL_REGEX,
  registerValidation,
  loginValidation,
  verifyOtpValidation,
  resendOtpValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  adminLoginValidation,
  handleValidation,
};
