const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    clearMocks: true,
    env: {
      NODE_ENV: 'test',
      CSRF_SECRET: 'test-csrf-secret',
      POLL_RATE_LIMIT_PER_MINUTE: '2',
      GLOBAL_RATE_LIMIT_PER_MINUTE: '1000',
      LOG_DIR: 'logs',
      APP_TIMEZONE: 'Europe/Samara',
    },
  },
});
