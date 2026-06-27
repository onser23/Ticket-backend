const { verifyUserToken, verifyAdminToken } = require('../utils/jwt');

// Accepts BOTH user and admin tokens (used for endpoints that serve both roles)
// Sets req.userRole = 'user' or 'admin' so handlers can branch logic
function authOrAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tələb olunur' });
  }
  const token = header.split(' ')[1];

  // Try user token first
  try {
    const payload = verifyUserToken(token);
    req.userId = payload.userId;
    req.userRole = 'user';
    return next();
  } catch (e) {
    // Try admin token
    try {
      const payload = verifyAdminToken(token);
      req.adminId = payload.adminId;
      req.userRole = 'admin';
      return next();
    } catch (e2) {
      return res.status(401).json({ success: false, message: 'Token etibarsız və ya vaxtı keçib' });
    }
  }
}

module.exports = authOrAdmin;
