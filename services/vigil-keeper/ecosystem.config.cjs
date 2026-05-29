module.exports = {
  apps: [
    {
      name: 'atrium-vigil-keeper',
      script: 'dist/tick.js',
      cwd: '/srv/atrium/vigil-keeper',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_memory_restart: '256M',
      cron_restart: '0 4 * * *',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: '/var/log/vigil-keeper/out.log',
      error_file: '/var/log/vigil-keeper/err.log',
    },
  ],
};
