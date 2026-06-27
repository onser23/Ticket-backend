function notFound(req, res, next) {
  res.status(404).json({ success: false, message: 'Route tapılmadı' });
}

function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.stack || err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Daxili server xətası',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
