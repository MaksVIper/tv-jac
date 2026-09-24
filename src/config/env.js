const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default('jaco_tv'),
  DB_PASSWORD: z.string().default(''),
  DB_MAIN_DATABASE: z.string().regex(/^[A-Za-z0-9_]+$/).default('jaco_main_rolls'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(50).default(10),
  CSRF_SECRET: z.string().min(isTest ? 8 : 32).default(
    isTest ? 'test-csrf-secret' : 'replace-with-at-least-32-random-characters',
  ),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  APP_TIMEZONE: z.string().default('Europe/Samara'),
  TIME_READY_SHOW_MINUTES: z.coerce.number().int().min(1).default(5),
  TIME_FINISH_SHOW_MINUTES: z.coerce.number().int().min(1).default(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('error'),
  LOG_DIR: z.string().default('logs'),
  GLOBAL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(180),
  POLL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  MAX_CONCURRENT_REQUESTS: z.coerce.number().int().min(1).default(100),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
}

if (
  parsed.data.NODE_ENV === 'production'
  && parsed.data.CSRF_SECRET === 'replace-with-at-least-32-random-characters'
) {
  throw new Error('CSRF_SECRET must be changed in production');
}

module.exports = Object.freeze({
  ...parsed.data,
  LOG_DIR: path.resolve(process.cwd(), parsed.data.LOG_DIR),
});
