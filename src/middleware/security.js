const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');

const CSRF_COOKIE = env.COOKIE_SECURE ? '__Host-tv-csrf' : 'tv-csrf';

function signCsrfToken(nonce) {
  const signature = crypto
    .createHmac('sha256', env.CSRF_SECRET)
    .update(nonce)
    .digest('base64url');
  return `${nonce}.${signature}`;
}

function issueCsrfToken(req, res) {
  const existing = req.cookies[CSRF_COOKIE];
  const token = existing && verifySignedToken(existing)
    ? existing
    : signCsrfToken(crypto.randomBytes(24).toString('base64url'));

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
  return token;
}

function verifySignedToken(token) {
  if (typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const nonce = token.slice(0, dot);
  const expected = signCsrfToken(nonce);
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function csrfProtection(req, res, next) {
  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (
    !cookieToken
    || !headerToken
    || cookieToken !== headerToken
    || !verifySignedToken(cookieToken)
  ) {
    return res.status(403).json({ st: false, error: 'Недействительный CSRF-токен' });
  }
  return next();
}

function sameOrigin(req, res, next) {
  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    return res.status(403).json({ st: false, error: 'Cross-site запрос запрещён' });
  }

  const origin = req.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== req.get('host')) {
        return res.status(403).json({ st: false, error: 'Origin запрещён' });
      }
    } catch {
      return res.status(403).json({ st: false, error: 'Некорректный Origin' });
    }
  }
  return next();
}

function concurrentRequests(maxRequests) {
  let active = 0;
  return (req, res, next) => {
    if (active >= maxRequests) {
      res.set('Retry-After', '1');
      return res.status(503).json({ st: false, error: 'Сервер занят' });
    }

    active += 1;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active -= 1;
      }
    };
    res.once('finish', release);
    res.once('close', release);
    return next();
  };
}

function limiter(max, message) {
  return rateLimit({
    windowMs: 60_000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { trustProxy: true },
    message: { st: false, error: message },
    skip: (req) => req.path === '/health',
  });
}

module.exports = {
  csrfProtection,
  createGlobalLimiter: () => limiter(env.GLOBAL_RATE_LIMIT_PER_MINUTE, 'Слишком много запросов'),
  createPollLimiter: () => limiter(env.POLL_RATE_LIMIT_PER_MINUTE, 'Слишком частый опрос'),
  issueCsrfToken,
  sameOrigin,
  concurrentRequests,
};
