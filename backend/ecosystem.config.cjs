module.exports = {
  apps: [
    {
      name: 'bidkore-api',
      script: 'src/index.ts',
      interpreter: './node_modules/.bin/tsx',
      cwd: '/home/bidkore-backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      log_file: '/home/bidkore-backend/logs/combined.log',
      out_file: '/home/bidkore-backend/logs/out.log',
      error_file: '/home/bidkore-backend/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true
    }
  ]
};
