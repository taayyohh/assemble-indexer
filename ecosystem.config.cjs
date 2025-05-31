module.exports = {
  apps: [
    // Simple production indexer - just like running "pnpm start" 
    {
      name: 'assemble-indexer',
      script: 'pnpm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',

      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',

      // Environment variables (PM2 will use your .env file)
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },

      // Logging
      out_file: './logs/indexer-out.log',
      error_file: './logs/indexer-error.log',
      log_file: './logs/indexer-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Advanced PM2 features
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      shutdown_with_message: true
    },

    // Development mode (optional)
    {
      name: 'assemble-dev-mode',
      script: 'pnpm',
      args: 'dev',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development'
      },
      out_file: './logs/dev-out.log',
      error_file: './logs/dev-error.log',
      log_file: './logs/dev-combined.log',
      time: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    }
  ]
}; 