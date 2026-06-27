const { verifyAdminToken } = require('../utils/jwt');

function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Admin token tələb olunur' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = verifyAdminToken(token);
    req.adminId = payload.adminId;
    req.userRole = 'admin';
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Admin token etibarsız' });
  }
}

module.exports = adminAuth;
