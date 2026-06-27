const jwt = require('jsonwebtoken');

const JWT_USER_SECRET = process.env.JWT_USER_SECRET || 'dev-user-secret-change-in-prod';
const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || 'dev-admin-secret-change-in-prod';

function signUserToken(payload) {
  return jwt.sign(payload, JWT_USER_SECRET, { expiresIn: '24h' });
}

function verifyUserToken(token) {
  return jwt.verify(token, JWT_USER_SECRET);
}

function signAdminToken(payload) {
  return jwt.sign(payload, JWT_ADMIN_SECRET, { expiresIn: '12h' });
}

function verifyAdminToken(token) {
  return jwt.verify(token, JWT_ADMIN_SECRET);
}

module.exports = {
  signUserToken,
  verifyUserToken,
  signAdminToken,
  verifyAdminToken,
};
