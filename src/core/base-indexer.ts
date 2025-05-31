import { PrismaClient } from '@prisma/client';
import type { 
  IndexerConfig, 
  ChainConfig, 
  Logger, 
  IndexerState, 
  IndexerMetrics, 
  BaseIndexerInterface,
  EventHandler,
  EventContext,
  LogData 
} from '@/types';
import { IndexerLogger } from '@/utils/logger';
import { RetryManager } from './retry-manager';
import { StateManager } from './state-manager';
import { BlockchainClient } from './blockchain-client';

export class BaseIndexer implements BaseIndexerInterface {
  private readonly config: IndexerConfig;
  private readonly logger: Logger;
  private readonly prisma: PrismaClient;
  private readonly retryManager: RetryManager;
  private readonly stateManager: StateManager;
  private readonly blockchainClients = new Map<number, BlockchainClient>();
  private readonly eventHandlers = new Map<string, EventHandler>();
  
  private isRunning = false;
  private startTime = Date.now();
  private processingLoops = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly metrics = {
    blocksProcessed: 0,
    eventsProcessed: 0,
    errorsEncountered: 0,
    rpcCallsCount: 0,
    databaseWrites: 0,
    blockProcessingTimes: [] as number[]
  };

  constructor(config: IndexerConfig) {
    this.config = config;
    this.logger = new IndexerLogger(config.logging.level, config.logging.filePath);
    this.prisma = new PrismaClient();
    
    // Initialize core components
    this.retryManager = new RetryManager(
      config.retry,
      config.circuitBreaker.threshold,
      config.circuitBreaker.timeout,
      this.logger
    );
    
    this.stateManager = new StateManager(this.prisma, this.logger);
    
    // Initialize blockchain clients for all chains
    for (const chainConfig of config.chains) {
      const client = new BlockchainClient(chainConfig, this.logger, this.retryManager);
      this.blockchainClients.set(chainConfig.chainId, client);
    }
  }

  /**
   * Register an event handler
   */
  registerEventHandler(handler: EventHandler): void {
    this.eventHandlers.set(handler.eventName, handler);
    this.logger.info(`Registered event handler`, {
      eventName: handler.eventName
    });
  }

  /**
   * Start the indexer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Indexer is already running');
      return;
    }

    this.logger.info('🚀 Starting Assemble Protocol Indexer', {
      chains: this.config.chains.map(c => ({ chainId: c.chainId, name: c.name })),
      eventHandlers: Array.from(this.eventHandlers.keys())
    });

    try {
      // Initialize database state management
      const chainIds = this.config.chains.map(c => c.chainId);
      await this.stateManager.initializeStates(chainIds);

      // Initialize all blockchain clients
      await this.initializeBlockchainClients();

      // Start processing loops for each chain
      await this.startProcessingLoops();

      this.isRunning = true;
      this.startTime = Date.now();

      this.logger.info('✅ Indexer started successfully', {
        uptime: 0,
        chains: chainIds
      });

    } catch (error) {
      this.logger.error('Failed to start indexer', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Stop the indexer gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Indexer is not running');
      return;
    }

    this.logger.info('🛑 Stopping indexer gracefully...');

    // Stop all processing loops
    for (const [chainId, timeoutId] of this.processingLoops) {
      clearTimeout(timeoutId);
      this.logger.debug(`Stopped processing loop for chain ${chainId}`);
    }
    this.processingLoops.clear();

    // Disconnect blockchain clients
    for (const [chainId, client] of this.blockchainClients) {
      try {
        await client.disconnect();
        this.logger.debug(`Disconnected blockchain client for chain ${chainId}`);
      } catch (error) {
        this.logger.warn(`Error disconnecting client for chain ${chainId}`, {
          error: (error as Error).message
        });
      }
    }

    // Shutdown state manager (creates final checkpoint)
    await this.stateManager.shutdown();

    // Disconnect database
    await this.prisma.$disconnect();

    this.isRunning = false;

    this.logger.info('✅ Indexer stopped gracefully', {
      totalUptime: Date.now() - this.startTime,
      finalMetrics: await this.getMetrics()
    });
  }

  /**
   * Initialize all blockchain clients
   */
  private async initializeBlockchainClients(): Promise<void> {
    this.logger.info('Initializing blockchain clients...');

    const initPromises = Array.from(this.blockchainClients.entries()).map(
      async ([chainId, client]) => {
        try {
          await client.initialize();
          this.logger.info(`✅ Initialized blockchain client for chain ${chainId}`);
        } catch (error) {
          this.logger.error(`❌ Failed to initialize blockchain client for chain ${chainId}`, {
            chainId,
            error: (error as Error).message
          });
          throw error;
        }
      }
    );

    await Promise.all(initPromises);
    this.logger.info('All blockchain clients initialized successfully');
  }

  /**
   * Start processing loops for all chains
   */
  private async startProcessingLoops(): Promise<void> {
    this.logger.info('Starting processing loops for all chains...');

    for (const chainConfig of this.config.chains) {
      await this.startChainProcessingLoop(chainConfig);
    }

    this.logger.info('All processing loops started');
  }

  /**
   * Start processing loop for a specific chain
   */
  private async startChainProcessingLoop(chainConfig: ChainConfig): Promise<void> {
    const processChain = async () => {
      if (!this.isRunning) return;

      try {
        await this.processChainBlocks(chainConfig);
      } catch (error) {
        this.metrics.errorsEncountered++;
        this.stateManager.recordError(chainConfig.chainId, error as Error);
        
        this.logger.error(`Error processing chain ${chainConfig.chainId}`, {
          chainId: chainConfig.chainId,
          error: (error as Error).message,
          errorCount: this.metrics.errorsEncountered
        });
      }

      // Schedule next processing cycle
      if (this.isRunning) {
        const timeoutId = setTimeout(processChain, chainConfig.blockPollingInterval);
        this.processingLoops.set(chainConfig.chainId, timeoutId);
      }
    };

    // Start the processing loop
    processChain();
    
    this.logger.info(`Started processing loop for ${chainConfig.name}`, {
      chainId: chainConfig.chainId,
      pollingInterval: chainConfig.blockPollingInterval
    });
  }

  /**
   * Process blocks for a specific chain
   */
  private async processChainBlocks(chainConfig: ChainConfig): Promise<void> {
    const startTime = Date.now();
    const client = this.blockchainClients.get(chainConfig.chainId)!;
    const currentState = this.stateManager.getState(chainConfig.chainId);
    
    if (!currentState) {
      throw new Error(`No state found for chain ${chainConfig.chainId}`);
    }

    try {
      // Get current blockchain state
      this.metrics.rpcCallsCount++;
      const latestBlockNumber = await client.getLatestBlockNumber();
      
      // Determine range to process
      const fromBlock = currentState.lastBlock === BigInt(0) 
        ? chainConfig.startBlock 
        : currentState.lastBlock + BigInt(1);
      
      const toBlock = latestBlockNumber;

      // Skip if no new blocks
      if (fromBlock > toBlock) {
        return;
      }

      // Process blocks in batches to avoid overwhelming the RPC
      const maxBatchSize = 100;
      const totalBlocks = Number(toBlock - fromBlock + BigInt(1));
      
      this.logger.debug(`Processing blocks for ${chainConfig.name}`, {
        chainId: chainConfig.chainId,
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        totalBlocks
      });

      for (let i = 0; i < totalBlocks; i += maxBatchSize) {
        const batchFromBlock = fromBlock + BigInt(i);
        const batchToBlock = fromBlock + BigInt(Math.min(i + maxBatchSize - 1, totalBlocks - 1));
        
        await this.processBatch(chainConfig, client, batchFromBlock, batchToBlock);
      }

      // Update state with latest processed block
      this.stateManager.recordBlockProcessed(chainConfig.chainId, toBlock);
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.metrics.blockProcessingTimes.push(processingTime);
      this.metrics.blocksProcessed += totalBlocks;

      if (totalBlocks > 0) {
        this.logger.info(`Processed ${totalBlocks} blocks for ${chainConfig.name}`, {
          chainId: chainConfig.chainId,
          fromBlock: fromBlock.toString(),
          toBlock: toBlock.toString(),
          processingTimeMs: processingTime
        });
      }

    } catch (error) {
      throw new Error(`Failed to process blocks for chain ${chainConfig.chainId}: ${(error as Error).message}`);
    }
  }

  /**
   * Process a batch of blocks
   */
  private async processBatch(
    chainConfig: ChainConfig,
    client: BlockchainClient,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<void> {
    try {
      // Get logs for the batch
      this.metrics.rpcCallsCount++;
      const logs = await client.getLogs(fromBlock, toBlock);

      // Process each log
      for (const log of logs) {
        await this.processLog(chainConfig.chainId, log);
      }

    } catch (error) {
      throw new Error(`Failed to process batch ${fromBlock}-${toBlock}: ${(error as Error).message}`);
    }
  }

  /**
   * Process a single log entry
   */
  private async processLog(chainId: number, log: LogData): Promise<void> {
    try {
      // Check if already processed (deduplication)
      const alreadyProcessed = await this.stateManager.isEventProcessed(
        chainId,
        log.transactionHash,
        log.logIndex
      );

      if (alreadyProcessed) {
        this.logger.debug('Event already processed, skipping', {
          chainId,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex
        });
        return;
      }

      // Try to decode and handle the event
      const handled = await this.tryHandleEvent(chainId, log);

      if (handled) {
        // Mark as processed
        await this.stateManager.markEventProcessed(
          chainId,
          log.blockNumber,
          log.transactionHash,
          log.logIndex,
          handled.eventName
        );

        this.metrics.eventsProcessed++;
        this.metrics.databaseWrites++;

        this.logger.debug('Successfully processed event', {
          chainId,
          eventName: handled.eventName,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex
        });
      }

    } catch (error) {
      this.logger.error('Failed to process log', {
        chainId,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Try to handle an event with registered handlers
   */
  private async tryHandleEvent(chainId: number, log: LogData): Promise<{ eventName: string } | null> {
    // For now, we'll implement a basic topic-based detection
    // In a real implementation, you'd use ABI decoding
    
    for (const [eventName, handler] of this.eventHandlers) {
      try {
        // Create event context
        const context: EventContext = {
          chainId,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
          prisma: this.prisma,
          logger: this.logger
        };

        // For now, pass the raw log data
        // In a real implementation, you'd decode the event data using ABI
        await handler.handle(log, {}, context);
        
        return { eventName };
        
      } catch (error) {
        // Handler didn't match or failed - continue to next handler
        continue;
      }
    }

    return null;
  }

  /**
   * Get indexer state for a specific chain
   */
  async getState(chainId: number): Promise<IndexerState | null> {
    return this.stateManager.getState(chainId);
  }

  /**
   * Get comprehensive metrics
   */
  async getMetrics(): Promise<IndexerMetrics> {
    const uptime = Date.now() - this.startTime;
    
    // Calculate average block processing time
    const avgProcessingTime = this.metrics.blockProcessingTimes.length > 0
      ? this.metrics.blockProcessingTimes.reduce((a, b) => a + b, 0) / this.metrics.blockProcessingTimes.length
      : 0;

    // Get latest processed block across all chains
    const states = this.config.chains.map(c => this.stateManager.getState(c.chainId));
    const lastProcessedBlock = states.reduce((max, state) => {
      return state && state.lastBlock > max ? state.lastBlock : max;
    }, BigInt(0));

    return {
      blocksProcessed: this.metrics.blocksProcessed,
      eventsProcessed: this.metrics.eventsProcessed,
      errorsEncountered: this.metrics.errorsEncountered,
      averageBlockProcessingTime: avgProcessingTime,
      uptime,
      lastProcessedBlock,
      rpcCallsCount: this.metrics.rpcCallsCount,
      databaseWrites: this.metrics.databaseWrites
    };
  }

  /**
   * Check if the indexer is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isRunning) {
      return false;
    }

    // Check if all chains are healthy
    const healthStatuses = this.stateManager.getHealthStatus();
    const allChainsHealthy = Array.from(healthStatuses.values()).every(Boolean);

    // Check blockchain client connections
    const clientPromises = Array.from(this.blockchainClients.values()).map(
      client => client.isHealthy()
    );
    const clientHealths = await Promise.all(clientPromises);
    const allClientsHealthy = clientHealths.every(Boolean);

    return allChainsHealthy && allClientsHealthy;
  }

  /**
   * Get detailed health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    uptime: number;
    chains: Array<{
      chainId: number;
      name: string;
      isHealthy: boolean;
      lastBlock: string;
      connectionStatus: any;
    }>;
  }> {
    const isHealthy = await this.isHealthy();
    const uptime = Date.now() - this.startTime;
    
    const chains = await Promise.all(
      this.config.chains.map(async (chainConfig) => {
        const state = this.stateManager.getState(chainConfig.chainId);
        const client = this.blockchainClients.get(chainConfig.chainId)!;
        
        return {
          chainId: chainConfig.chainId,
          name: chainConfig.name,
          isHealthy: state?.isHealthy || false,
          lastBlock: state?.lastBlock.toString() || '0',
          connectionStatus: client.getConnectionStatus()
        };
      })
    );

    return {
      isHealthy,
      uptime,
      chains
    };
  }
} 