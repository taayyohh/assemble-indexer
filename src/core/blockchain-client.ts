import { 
  createPublicClient, 
  http, 
  webSocket,
  type PublicClient,
  type GetLogsParameters,
  type Chain
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type { ChainConfig, Logger, BlockData, LogData } from '../types';
import { RetryManager } from './retry-manager';

export class BlockchainClient {
  private readonly config: ChainConfig;
  private readonly logger: Logger;
  private readonly retryManager: RetryManager;
  private publicClient: PublicClient;
  private wsClient: PublicClient | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  constructor(config: ChainConfig, logger: Logger, retryManager: RetryManager) {
    this.config = config;
    this.logger = logger;
    this.retryManager = retryManager;
    
    // Initialize HTTP client
    this.publicClient = this.createHttpClient();
  }

  /**
   * Initialize the blockchain client with WebSocket if available, HTTP fallback
   */
  async initialize(): Promise<void> {
    this.logger.info(`Initializing blockchain client for ${this.config.name}`, {
      chainId: this.config.chainId,
      hasWebSocket: !!this.config.wsUrl
    });

    // Try WebSocket first if available
    if (this.config.wsUrl) {
      try {
        await this.connectWebSocket();
      } catch (error) {
        this.logger.warn(`WebSocket connection failed for ${this.config.name}, falling back to HTTP`, {
          chainId: this.config.chainId,
          error: (error as Error).message
        });
      }
    }

    // Test HTTP connection
    await this.testConnection();
    this.isConnected = true;

    this.logger.info(`Successfully initialized blockchain client for ${this.config.name}`, {
      chainId: this.config.chainId,
      transport: this.wsClient ? 'WebSocket' : 'HTTP'
    });
  }

  /**
   * Get the viem chain configuration
   */
  private getViemChain(): Chain {
    switch (this.config.chainId) {
      case 1:
        return mainnet;
      case 11155111:
        return sepolia;
      default:
        // Generic chain configuration for viem
        return {
          id: this.config.chainId,
          name: this.config.name,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: {
            default: { http: [this.config.rpcUrl] },
            public: { http: [this.config.rpcUrl] }
          }
        };
    }
  }

  /**
   * Create HTTP public client
   */
  private createHttpClient(): PublicClient {
    const chain = this.getViemChain();
    return createPublicClient({
      chain,
      transport: http(this.config.rpcUrl, {
        timeout: 30000, // 30 second timeout
        retryCount: 0, // We handle retries ourselves
      })
    });
  }

  /**
   * Create WebSocket public client
   */
  private createWebSocketClient(): PublicClient {
    if (!this.config.wsUrl) {
      throw new Error('WebSocket URL not configured');
    }

    const chain = this.getViemChain();
    return createPublicClient({
      chain,
      transport: webSocket(this.config.wsUrl, {
        timeout: 30000
      })
    });
  }

  /**
   * Connect WebSocket with retry logic
   */
  private async connectWebSocket(): Promise<void> {
    return this.retryManager.executeWithRetry(
      async () => {
        this.wsClient = this.createWebSocketClient();
        // Test the connection
        await this.wsClient.getChainId();
        this.logger.info(`WebSocket connected for ${this.config.name}`, {
          chainId: this.config.chainId
        });
      },
      `websocket-connect-${this.config.chainId}`,
      this.config.chainId
    );
  }

  /**
   * Test connection by getting chain ID
   */
  private async testConnection(): Promise<void> {
    return this.retryManager.executeWithRetry(
      async () => {
        const client = this.getActiveClient();
        const chainId = await client.getChainId();
        
        if (chainId !== this.config.chainId) {
          throw new Error(`Chain ID mismatch: expected ${this.config.chainId}, got ${chainId}`);
        }
        
        this.logger.debug(`Connection test passed for ${this.config.name}`, {
          chainId,
          transport: this.wsClient ? 'WebSocket' : 'HTTP'
        });
      },
      `connection-test-${this.config.chainId}`,
      this.config.chainId
    );
  }

  /**
   * Get the active client (WebSocket preferred, HTTP fallback)
   */
  private getActiveClient(): PublicClient {
    return this.wsClient || this.publicClient;
  }

  /**
   * Get the latest block number
   */
  async getLatestBlockNumber(): Promise<bigint> {
    return this.retryManager.executeWithRetry(
      async () => {
        const client = this.getActiveClient();
        return await client.getBlockNumber();
      },
      `get-latest-block-${this.config.chainId}`,
      this.config.chainId
    );
  }

  /**
   * Get block by number with full transaction details
   */
  async getBlock(blockNumber: bigint): Promise<BlockData> {
    return this.retryManager.executeWithRetry(
      async () => {
        const client = this.getActiveClient();
        const block = await client.getBlock({
          blockNumber,
          includeTransactions: false
        });

        return {
          number: block.number!,
          hash: block.hash!,
          timestamp: Number(block.timestamp),
          parentHash: block.parentHash!
        };
      },
      `get-block-${this.config.chainId}`,
      this.config.chainId
    );
  }

  /**
   * Get logs for a specific block range
   */
  async getLogs(fromBlock: bigint, toBlock: bigint): Promise<LogData[]> {
    return this.retryManager.executeWithRetry(
      async () => {
        const client = this.getActiveClient();
        
        const getLogsParams: GetLogsParameters = {
          address: this.config.contractAddress as `0x${string}`,
          fromBlock,
          toBlock
        };

        const logs = await client.getLogs(getLogsParams);

        return logs.map((log): LogData => ({
          address: log.address,
          topics: log.topics as string[],
          data: log.data,
          blockNumber: log.blockNumber!,
          blockHash: log.blockHash!,
          transactionHash: log.transactionHash!,
          transactionIndex: log.transactionIndex!,
          logIndex: log.logIndex!,
          removed: log.removed || false
        }));
      },
      `get-logs-${this.config.chainId}`,
      this.config.chainId
    );
  }

  /**
   * Get the current chain ID
   */
  async getChainId(): Promise<number> {
    return this.retryManager.executeWithRetry(
      async () => {
        const client = this.getActiveClient();
        return await client.getChainId();
      },
      `get-chain-id-${this.config.chainId}`,
      this.config.chainId
    );
  }

  /**
   * Check if the client is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.getChainId();
      return true;
    } catch (error) {
      this.logger.warn(`Health check failed for ${this.config.name}`, {
        chainId: this.config.chainId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Reconnect WebSocket if it's disconnected
   */
  async reconnectWebSocket(): Promise<void> {
    if (!this.config.wsUrl || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`Attempting WebSocket reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, {
      chainId: this.config.chainId
    });

    try {
      if (this.wsClient) {
        this.wsClient = null;
      }
      
      await this.connectWebSocket();
      this.reconnectAttempts = 0;
      
    } catch (error) {
      this.logger.error(`WebSocket reconnection failed`, {
        chainId: this.config.chainId,
        attempt: this.reconnectAttempts,
        error: (error as Error).message
      });
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.logger.warn(`Max WebSocket reconnection attempts reached, using HTTP only`, {
          chainId: this.config.chainId
        });
      }
    }
  }

  /**
   * Gracefully disconnect
   */
  async disconnect(): Promise<void> {
    this.logger.info(`Disconnecting blockchain client for ${this.config.name}`, {
      chainId: this.config.chainId
    });

    this.wsClient = null;
    this.isConnected = false;
    
    this.logger.info(`Disconnected blockchain client for ${this.config.name}`, {
      chainId: this.config.chainId
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    hasWebSocket: boolean;
    reconnectAttempts: number;
  } {
    return {
      isConnected: this.isConnected,
      hasWebSocket: !!this.wsClient,
      reconnectAttempts: this.reconnectAttempts
    };
  }
} 