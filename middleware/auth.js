const { verifyUserToken } = require('../utils/jwt');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tələb olunur' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = verifyUserToken(token);
    req.userId = payload.userId;
    req.userRole = 'user';
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token etibarsız və ya vaxtı keçib' });
  }
}

module.exports = auth;
