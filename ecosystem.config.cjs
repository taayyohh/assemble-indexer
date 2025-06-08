module.exports = {
  apps: [
    // Production indexer for Enhanced Assemble Protocol (8 Chains)
    {
      name: 'assemble-indexer',
      script: 'node',
      args: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',

      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '6G', // Increased for 8-chain processing

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
      max_log_size: '100M', // Increased for multi-chain logs
      retain_logs: 15,

      // Enhanced PM2 settings for multi-chain blockchain indexing
      min_uptime: '60s', // Longer wait for 8 chains to initialize
      max_restarts: 3,   // Conservative for production
      restart_delay: 30000, // 30 second delay between restarts
      kill_timeout: 30000,  // Longer grace period for 8 blockchain connections
      wait_ready: true,
      listen_timeout: 60000, // 60s timeout for all chains to connect
      shutdown_with_message: true,

      // Health monitoring
      watch_delay: 1000,
      ignore_watch: [
        'node_modules',
        'logs',
        'dist',
        '*.log',
        'coverage'
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
      max_memory_restart: '4G', // Increased for dev multi-chain
      
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug'
      },
      
      out_file: './logs/dev-out.log',
      error_file: './logs/dev-error.log', 
      log_file: './logs/dev-combined.log',
      time: true,
      merge_logs: true,
      
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 10000,
      kill_timeout: 15000,
      listen_timeout: 45000
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