module.exports = {
  apps: [
    {
      name: 'atrium-lantern-attestor',
      script: 'dist/index.js',
      cwd: '/srv/atrium/lantern-attestor',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_memory_restart: '256M',
      cron_restart: '0 4 * * *',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: '/var/log/lantern-attestor/out.log',
      error_file: '/var/log/lantern-attestor/err.log',
    },
  ],
};
