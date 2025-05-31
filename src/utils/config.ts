import type { IndexerConfig, ChainConfig } from '@/types';

/**
 * Load configuration from environment variables
 */
export function loadConfig(): IndexerConfig {
  // Helper to get required env var
  const getRequiredEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is missing`);
    }
    return value;
  };

  // Helper to get optional env var with default
  const getOptionalEnv = (key: string, defaultValue: string): string => {
    return process.env[key] || defaultValue;
  };

  // Helper to get number env var
  const getNumberEnv = (key: string, defaultValue: number): number => {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} must be a valid number`);
    }
    return parsed;
  };

  // Helper to get bigint env var
  const getBigIntEnv = (key: string, defaultValue: bigint): bigint => {
    const value = process.env[key];
    if (!value) return defaultValue;
    try {
      return BigInt(value);
    } catch {
      throw new Error(`Environment variable ${key} must be a valid number`);
    }
  };

  // Build chain configurations
  const chains: ChainConfig[] = [
    {
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: getRequiredEnv('ETHEREUM_RPC_URL'),
      wsUrl: getOptionalEnv('ETHEREUM_WS_URL', ''),
      startBlock: getBigIntEnv('START_BLOCK_ETHEREUM', BigInt(20000000)),
      blockPollingInterval: getNumberEnv('BLOCK_POLLING_INTERVAL', 12000),
      contractAddress: getRequiredEnv('ASSEMBLE_CONTRACT_ADDRESS')
    },
    {
      chainId: 480,
      name: 'World Chain',
      rpcUrl: getRequiredEnv('WORLD_CHAIN_RPC_URL'),
      wsUrl: getOptionalEnv('WORLD_CHAIN_WS_URL', ''),
      startBlock: getBigIntEnv('START_BLOCK_WORLD_CHAIN', BigInt(0)),
      blockPollingInterval: getNumberEnv('BLOCK_POLLING_INTERVAL', 12000),
      contractAddress: getRequiredEnv('ASSEMBLE_CONTRACT_ADDRESS')
    },
    {
      chainId: 747,
      name: 'Flow EVM',
      rpcUrl: getRequiredEnv('FLOW_EVM_RPC_URL'),
      wsUrl: getOptionalEnv('FLOW_EVM_WS_URL', ''),
      startBlock: getBigIntEnv('START_BLOCK_FLOW_EVM', BigInt(0)),
      blockPollingInterval: getNumberEnv('BLOCK_POLLING_INTERVAL', 12000),
      contractAddress: getRequiredEnv('ASSEMBLE_CONTRACT_ADDRESS')
    },
    {
      chainId: 11155111,
      name: 'Sepolia Testnet',
      rpcUrl: getRequiredEnv('SEPOLIA_RPC_URL'),
      wsUrl: getOptionalEnv('SEPOLIA_WS_URL', ''),
      startBlock: getBigIntEnv('START_BLOCK_SEPOLIA', BigInt(0)),
      blockPollingInterval: getNumberEnv('BLOCK_POLLING_INTERVAL', 12000),
      contractAddress: getRequiredEnv('ASSEMBLE_CONTRACT_ADDRESS')
    }
  ];

  // Build complete configuration
  const config: IndexerConfig = {
    chains,
    database: {
      url: getRequiredEnv('DATABASE_URL')
    },
    graphql: {
      port: getNumberEnv('GRAPHQL_PORT', 4000),
      endpoint: getOptionalEnv('GRAPHQL_ENDPOINT', '/graphql')
    },
    retry: {
      maxRetries: getNumberEnv('MAX_RETRIES', 5),
      baseDelay: getNumberEnv('RETRY_BASE_DELAY', 1000),
      maxDelay: getNumberEnv('RETRY_MAX_DELAY', 30000),
      jitter: true
    },
    circuitBreaker: {
      threshold: getNumberEnv('CIRCUIT_BREAKER_THRESHOLD', 5),
      timeout: getNumberEnv('CIRCUIT_BREAKER_TIMEOUT', 60000)
    },
    logging: {
      level: (getOptionalEnv('LOG_LEVEL', 'info') as 'error' | 'warn' | 'info' | 'debug'),
      filePath: getOptionalEnv('LOG_FILE_PATH', './logs')
    },
    metrics: {
      enabled: getOptionalEnv('ENABLE_METRICS', 'true') === 'true',
      port: getNumberEnv('METRICS_PORT', 9090)
    }
  };

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config: IndexerConfig): void {
  // Validate chains
  if (!config.chains || config.chains.length === 0) {
    throw new Error('At least one chain configuration is required');
  }

  for (const chain of config.chains) {
    if (!chain.rpcUrl) {
      throw new Error(`RPC URL is required for chain ${chain.chainId}`);
    }
    
    if (!chain.contractAddress) {
      throw new Error(`Contract address is required for chain ${chain.chainId}`);
    }

    // Validate contract address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(chain.contractAddress)) {
      throw new Error(`Invalid contract address format for chain ${chain.chainId}: ${chain.contractAddress}`);
    }

    // Validate URLs
    try {
      new URL(chain.rpcUrl);
    } catch {
      throw new Error(`Invalid RPC URL for chain ${chain.chainId}: ${chain.rpcUrl}`);
    }

    if (chain.wsUrl) {
      try {
        new URL(chain.wsUrl);
      } catch {
        throw new Error(`Invalid WebSocket URL for chain ${chain.chainId}: ${chain.wsUrl}`);
      }
    }
  }

  // Validate database URL
  if (!config.database.url) {
    throw new Error('Database URL is required');
  }

  // Validate retry configuration
  if (config.retry.maxRetries < 0) {
    throw new Error('Max retries must be non-negative');
  }

  if (config.retry.baseDelay <= 0) {
    throw new Error('Base delay must be positive');
  }

  if (config.retry.maxDelay < config.retry.baseDelay) {
    throw new Error('Max delay must be greater than or equal to base delay');
  }

  // Validate logging level
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(config.logging.level)) {
    throw new Error(`Invalid log level: ${config.logging.level}. Must be one of: ${validLogLevels.join(', ')}`);
  }
} 