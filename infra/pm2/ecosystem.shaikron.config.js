// ecosystem.shaikron.config.js — PM2 para o backend do Shaikron

const APP_DIR = '/var/www/matrix'

module.exports = {
  apps: [
    {
      name: 'shaikron-api',
      cwd: `${APP_DIR}/apps/api`,
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_file: `${APP_DIR}/.env`,
      error_file: `${APP_DIR}/logs/shaikron-api-error.log`,
      out_file: `${APP_DIR}/logs/shaikron-api-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
