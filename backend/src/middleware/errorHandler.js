/** Central error handler: consistent JSON errors, no stack leakage in production. */
export function notFound(req, res) {
  res.status(404).json({ ok: false, error: 'Not found' });
}

export function errorHandler(err, req, res, _next) {
  console.error('[http]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    ok: false,
    error: status === 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && status === 500 ? { details: err.message } : {}),
  });
}
