const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_LENGTH = 6;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
  const max = 10 ** OTP_LENGTH;
  const min = 10 ** (OTP_LENGTH - 1);
  const code = crypto.randomInt(min, max).toString();
  return code;
}

async function hashOtp(plain) {
  return bcrypt.hash(plain, 10);
}

async function compareOtp(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

module.exports = {
  generateOtp,
  hashOtp,
  compareOtp,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
};
