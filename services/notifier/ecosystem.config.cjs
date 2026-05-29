module.exports = {
  apps: [
    {
      name: 'atrium-notifier',
      script: 'dist/tick.js',
      cwd: '/srv/atrium/notifier',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_memory_restart: '256M',
      cron_restart: '0 4 * * *',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: '/var/log/notifier/out.log',
      error_file: '/var/log/notifier/err.log',
    },
  ],
};
