module.exports = {
  apps: [
    // Production indexer for Enhanced Assemble Protocol
    {
      name: 'assemble-indexer',
      script: 'pnpm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',

      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '3G', // Increased for enhanced protocol features

      // Environment variables (PM2 will use your .env file)
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },

      // Logging with rotation
      out_file: './logs/indexer-out.log',
      error_file: './logs/indexer-error.log',
      log_file: './logs/indexer-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Log rotation
      max_log_size: '50M',
      retain_logs: 10,

      // Enhanced PM2 settings for blockchain indexing
      min_uptime: '30s', // Wait longer before considering it stable
      max_restarts: 5,   // Reduced for production stability
      restart_delay: 10000, // 10 second delay between restarts
      kill_timeout: 15000,  // Longer grace period for blockchain connections
      wait_ready: true,
      listen_timeout: 30000, // Longer timeout for blockchain connections
      shutdown_with_message: true,

      // Health monitoring
      watch_delay: 1000,
      ignore_watch: [
        'node_modules',
        'logs',
        'dist',
        '*.log'
      ]
    },

    // Development mode with enhanced features
    {
      name: 'assemble-dev-mode', 
      script: 'pnpm',
      args: 'dev',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false, // tsx handles file watching
      max_memory_restart: '1G',
      
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug'
      },
      
      out_file: './logs/dev-out.log',
      error_file: './logs/dev-error.log', 
      log_file: './logs/dev-combined.log',
      time: true,
      merge_logs: true,
      
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000
    },

    // Sepolia testnet indexer (optional)
    {
      name: 'assemble-indexer-sepolia',
      script: 'pnpm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        PREFERRED_CHAIN: 'sepolia' // Custom env var for your indexer
      },
      
      out_file: './logs/sepolia-out.log',
      error_file: './logs/sepolia-error.log',
      log_file: './logs/sepolia-combined.log',
      time: true,
      merge_logs: true,
      
      min_uptime: '30s',
      max_restarts: 5,
      restart_delay: 10000,
      kill_timeout: 15000,
      wait_ready: true,
      listen_timeout: 30000
    }
  ]
}; 