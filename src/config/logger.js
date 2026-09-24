const fs = require('node:fs');
const path = require('node:path');
const { Writable } = require('node:stream');
const pino = require('pino');
const rfs = require('rotating-file-stream');
const env = require('./env');

fs.mkdirSync(env.LOG_DIR, { recursive: true });

const fileStream = rfs.createStream('application.log', {
  path: env.LOG_DIR,
  interval: '1d',
  maxFiles: 1,
});

fileStream.on('rotated', (filename) => {
  const current = path.join(env.LOG_DIR, 'application.log');
  if (filename && filename !== current) {
    fs.unlink(filename, () => {});
  }
});

const streams = env.NODE_ENV === 'test'
  ? [{ level: 'silent', stream: new Writable({ write(_chunk, _encoding, callback) { callback(); } }) }]
  : [
      { level: 'error', stream: process.stdout },
      { level: 'error', stream: fileStream },
    ];

module.exports = pino(
  {
    level: env.NODE_ENV === 'test' ? 'silent' : 'error',
    base: { service: 'tv-jac' },
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers.x-csrf-token',
        'password',
        'DB_PASSWORD',
      ],
      censor: '[REDACTED]',
    },
  },
  pino.multistream(streams),
);
