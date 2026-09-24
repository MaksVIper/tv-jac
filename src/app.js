const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./config/logger');
const { createRouter } = require('./routes');
const { concurrentRequests, createGlobalLimiter } = require('./middleware/security');

function createApp(dependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.disable('etag');
  app.set('trust proxy', false);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(18).toString('base64');
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (_req, res) => `'nonce-${res.locals.cspNonce}'`],
        styleSrc: ["'self'", (_req, res) => `'nonce-${res.locals.cspNonce}'`],
        imgSrc: ["'self'", 'data:'],
        mediaSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }));
  app.use(pinoHttp({
    logger,
    genReqId(req, res) {
      const supplied = req.headers['x-request-id'];
      const id = typeof supplied === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(supplied)
        ? supplied
        : crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) return 'error';
      return 'silent';
    },
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url, remoteAddress: req.remoteAddress };
      },
    },
  }));
  app.use(concurrentRequests(env.MAX_CONCURRENT_REQUESTS));
  app.use(createGlobalLimiter());
  app.use(express.json({ limit: '16kb', strict: true, type: 'application/json' }));
  app.use(cookieParser());
  app.use('/public', express.static(path.join(__dirname, '..', 'public'), {
    dotfiles: 'deny',
    fallthrough: false,
    immutable: true,
    maxAge: '1d',
  }));

  app.use(createRouter(dependencies));

  app.use((_req, res) => {
    res.status(404).render('error', { message: 'Страница не найдена' });
  });

  app.use((error, req, res, _next) => {
    req.log.error({ err: error }, 'Request failed');
    if (res.headersSent) return;

    const status = Number(error.statusCode) >= 400 ? Number(error.statusCode) : 500;
    if (req.accepts('html') && !req.path.startsWith('/border_get_orders')) {
      res.status(status).render('error', {
        message: status >= 500 ? 'Внутренняя ошибка сервера' : error.message,
      });
      return;
    }
    res.status(status).json({
      st: false,
      error: status >= 500 ? 'Внутренняя ошибка сервера' : error.message,
    });
  });

  return app;
}

module.exports = { createApp };
