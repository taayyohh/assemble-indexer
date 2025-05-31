module.exports = {
  apps: [
    // Main production indexer - starts all chains
    {
      name: 'assemble-indexer',
      script: 'dist/multi-chain-indexer.js',
      instances: 1,
      exec_mode: 'fork',

      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',

      // Environment - will run all production chains
      env: {
        NODE_ENV: 'production',
        CHAINS: 'ethereum,world-chain,flow-evm', // Standardized chain names
        DATABASE_URL: process.env.DATABASE_URL,
        LOG_LEVEL: 'info',
        
        // Ethereum
        ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL,
        ETHEREUM_CONTRACT_ADDRESS: process.env.ETHEREUM_CONTRACT_ADDRESS,
        ETHEREUM_START_BLOCK: process.env.ETHEREUM_START_BLOCK || '0',
        
        // World Chain - using new standardized names
        WORLD_CHAIN_RPC_URL: process.env.WORLD_CHAIN_RPC_URL,
        WORLD_CHAIN_WS_URL: process.env.WORLD_CHAIN_WS_URL,
        START_BLOCK_WORLD_CHAIN: process.env.START_BLOCK_WORLD_CHAIN || '0',
        
        // Flow EVM - using new standardized names  
        FLOW_EVM_RPC_URL: process.env.FLOW_EVM_RPC_URL,
        FLOW_EVM_WS_URL: process.env.FLOW_EVM_WS_URL,
        START_BLOCK_FLOW_EVM: process.env.START_BLOCK_FLOW_EVM || '0',
        
        // Shared contract address for all chains
        ASSEMBLE_CONTRACT_ADDRESS: process.env.ASSEMBLE_CONTRACT_ADDRESS
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

    // Individual chain indexers (for granular control when needed)
    {
      name: 'assemble-indexer-ethereum',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        CHAIN_ID: '1',
        CHAIN_NAME: 'ethereum',
        RPC_URL: process.env.ETHEREUM_RPC_URL,
        CONTRACT_ADDRESS: process.env.ASSEMBLE_CONTRACT_ADDRESS,
        START_BLOCK: process.env.ETHEREUM_START_BLOCK || '0',
        DATABASE_URL: process.env.DATABASE_URL,
        LOG_LEVEL: 'info'
      },
      out_file: './logs/ethereum-out.log',
      error_file: './logs/ethereum-error.log',
      log_file: './logs/ethereum-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    },
    {
      name: 'assemble-indexer-world',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        CHAIN_ID: '480',
        CHAIN_NAME: 'world',
        RPC_URL: process.env.WORLD_CHAIN_RPC_URL,
        CONTRACT_ADDRESS: process.env.ASSEMBLE_CONTRACT_ADDRESS,
        START_BLOCK: process.env.START_BLOCK_WORLD_CHAIN || '0',
        DATABASE_URL: process.env.DATABASE_URL,
        LOG_LEVEL: 'info'
      },
      out_file: './logs/world-out.log',
      error_file: './logs/world-error.log',
      log_file: './logs/world-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    },
    {
      name: 'assemble-indexer-flow',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        CHAIN_ID: '747',
        CHAIN_NAME: 'flow-evm',
        RPC_URL: process.env.FLOW_EVM_RPC_URL,
        CONTRACT_ADDRESS: process.env.ASSEMBLE_CONTRACT_ADDRESS,
        START_BLOCK: process.env.START_BLOCK_FLOW_EVM || '0',
        DATABASE_URL: process.env.DATABASE_URL,
        LOG_LEVEL: 'info'
      },
      out_file: './logs/flow-out.log',
      error_file: './logs/flow-error.log',
      log_file: './logs/flow-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    },
    {
      name: 'assemble-indexer-sepolia',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        CHAIN_ID: '11155111',
        CHAIN_NAME: 'sepolia',
        RPC_URL: process.env.SEPOLIA_RPC_URL,
        CONTRACT_ADDRESS: process.env.SEPOLIA_CONTRACT_ADDRESS,
        START_BLOCK: process.env.SEPOLIA_START_BLOCK || '0',
        DATABASE_URL: process.env.DATABASE_URL,
        LOG_LEVEL: 'debug'
      },
      out_file: './logs/sepolia-out.log',
      error_file: './logs/sepolia-error.log',
      log_file: './logs/sepolia-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '5s',
      max_restarts: 15,
      restart_delay: 3000
    },
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