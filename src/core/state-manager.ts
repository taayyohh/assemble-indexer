import { PrismaClient } from '@prisma/client';
import type { IndexerState, Logger } from '@/types';

export class StateManager {
  private readonly prisma: PrismaClient;
  private readonly logger: Logger;
  private readonly checkpointInterval: number;
  private readonly stateCache = new Map<number, IndexerState>();
  private checkpointTimer?: ReturnType<typeof setInterval>;

  constructor(
    prisma: PrismaClient,
    logger: Logger,
    checkpointInterval: number = 30000 // 30 seconds
  ) {
    this.prisma = prisma;
    this.logger = logger;
    this.checkpointInterval = checkpointInterval;
  }

  /**
   * Initialize indexer state for all chains
   */
  async initializeStates(chainIds: number[]): Promise<void> {
    this.logger.info('Initializing indexer states', { chainIds });

    for (const chainId of chainIds) {
      try {
        let state = await this.prisma.indexerState.findUnique({
          where: { chainId }
        });

        if (!state) {
          // Create initial state
          state = await this.prisma.indexerState.create({
            data: {
              chainId,
              lastBlock: BigInt(0),
              isHealthy: true,
              errorCount: 0
            }
          });
          this.logger.info(`Created initial state for chain ${chainId}`);
        }

        // Cache the state
        this.stateCache.set(chainId, {
          chainId: state.chainId,
          lastBlock: state.lastBlock,
          lastUpdate: state.lastUpdate,
          isHealthy: state.isHealthy,
          errorCount: state.errorCount,
          lastError: state.lastError || undefined
        });

        this.logger.info(`Loaded state for chain ${chainId}`, {
          chainId,
          lastBlock: state.lastBlock.toString(),
          isHealthy: state.isHealthy,
          errorCount: state.errorCount
        });

      } catch (error) {
        this.logger.error(`Failed to initialize state for chain ${chainId}`, {
          chainId,
          error: (error as Error).message
        });
        throw error;
      }
    }

    // Start periodic checkpointing
    this.startCheckpointing();
  }

  /**
   * Get current state for a chain (from cache)
   */
  getState(chainId: number): IndexerState | null {
    return this.stateCache.get(chainId) || null;
  }

  /**
   * Update state in cache (will be persisted on next checkpoint)
   */
  updateState(chainId: number, updates: Partial<Omit<IndexerState, 'chainId'>>): void {
    const currentState = this.stateCache.get(chainId);
    
    if (!currentState) {
      this.logger.error(`Attempted to update state for unknown chain ${chainId}`);
      return;
    }

    const updatedState: IndexerState = {
      ...currentState,
      ...updates,
      lastUpdate: new Date()
    };

    this.stateCache.set(chainId, updatedState);
    
    this.logger.debug(`Updated state for chain ${chainId}`, {
      chainId,
      updates,
      newState: updatedState
    });
  }

  /**
   * Record a successful block processing
   */
  recordBlockProcessed(chainId: number, blockNumber: bigint): void {
    this.updateState(chainId, {
      lastBlock: blockNumber,
      isHealthy: true,
      errorCount: 0,
      lastError: undefined
    });
  }

  /**
   * Record an error during processing
   */
  recordError(chainId: number, error: Error): void {
    const currentState = this.getState(chainId);
    const newErrorCount = (currentState?.errorCount || 0) + 1;
    
    this.updateState(chainId, {
      errorCount: newErrorCount,
      lastError: error.message,
      isHealthy: newErrorCount < 5 // Mark as unhealthy after 5 consecutive errors
    });

    this.logger.warn(`Recorded error for chain ${chainId}`, {
      chainId,
      error: error.message,
      errorCount: newErrorCount,
      isHealthy: newErrorCount < 5
    });
  }

  /**
   * Create a checkpoint (save current state to database)
   */
  async createCheckpoint(chainId?: number): Promise<void> {
    const chainsToCheckpoint = chainId ? [chainId] : Array.from(this.stateCache.keys());

    for (const chain of chainsToCheckpoint) {
      const state = this.stateCache.get(chain);
      if (!state) continue;

      try {
        await this.prisma.indexerState.update({
          where: { chainId: chain },
          data: {
            lastBlock: state.lastBlock,
            lastUpdate: state.lastUpdate,
            isHealthy: state.isHealthy,
            errorCount: state.errorCount,
            lastError: state.lastError
          }
        });

        this.logger.debug(`Created checkpoint for chain ${chain}`, {
          chainId: chain,
          lastBlock: state.lastBlock.toString(),
          isHealthy: state.isHealthy,
          errorCount: state.errorCount
        });

      } catch (error) {
        this.logger.error(`Failed to create checkpoint for chain ${chain}`, {
          chainId: chain,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Get recovery information for crash recovery
   */
  async getRecoveryInfo(): Promise<Map<number, IndexerState>> {
    this.logger.info('Loading recovery information from database');
    
    const states = await this.prisma.indexerState.findMany();
    const recoveryMap = new Map<number, IndexerState>();

    for (const state of states) {
      recoveryMap.set(state.chainId, {
        chainId: state.chainId,
        lastBlock: state.lastBlock,
        lastUpdate: state.lastUpdate,
        isHealthy: state.isHealthy,
        errorCount: state.errorCount,
        lastError: state.lastError || undefined
      });
    }

    this.logger.info(`Loaded recovery info for ${recoveryMap.size} chains`, {
      chainIds: Array.from(recoveryMap.keys())
    });

    return recoveryMap;
  }

  /**
   * Check if a specific event has been processed (deduplication)
   */
  async isEventProcessed(
    chainId: number,
    transactionHash: string,
    logIndex: number
  ): Promise<boolean> {
    const existing = await this.prisma.processedEvent.findUnique({
      where: {
        chainId_transactionHash_logIndex: {
          chainId,
          transactionHash,
          logIndex
        }
      }
    });

    return existing !== null;
  }

  /**
   * Mark an event as processed
   */
  async markEventProcessed(
    chainId: number,
    blockNumber: bigint,
    transactionHash: string,
    logIndex: number,
    eventName: string
  ): Promise<void> {
    try {
      await this.prisma.processedEvent.create({
        data: {
          chainId,
          blockNumber,
          transactionHash,
          logIndex,
          eventName
        }
      });
    } catch (error) {
      // Ignore duplicate key errors (event already processed)
      if (!(error as Error).message.includes('duplicate') && 
          !(error as Error).message.includes('unique constraint')) {
        this.logger.error('Failed to mark event as processed', {
          chainId,
          transactionHash,
          logIndex,
          eventName,
          error: (error as Error).message
        });
        throw error;
      }
    }
  }

  /**
   * Clean up old processed events (older than specified days)
   */
  async cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.processedEvent.deleteMany({
      where: {
        processedAt: {
          lt: cutoffDate
        }
      }
    });

    this.logger.info(`Cleaned up ${result.count} old processed events`, {
      olderThanDays,
      cutoffDate,
      deletedCount: result.count
    });

    return result.count;
  }

  /**
   * Start periodic checkpointing
   */
  private startCheckpointing(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
    }

    this.checkpointTimer = setInterval(async () => {
      try {
        await this.createCheckpoint();
      } catch (error) {
        this.logger.error('Periodic checkpoint failed', {
          error: (error as Error).message
        });
      }
    }, this.checkpointInterval);

    this.logger.info('Started periodic checkpointing', {
      intervalMs: this.checkpointInterval
    });
  }

  /**
   * Stop checkpointing and create final checkpoint
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down StateManager');

    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = undefined;
    }

    // Create final checkpoint
    await this.createCheckpoint();
    
    this.logger.info('StateManager shutdown complete');
  }

  /**
   * Get health status for all chains
   */
  getHealthStatus(): Map<number, boolean> {
    const healthMap = new Map<number, boolean>();
    
    for (const [chainId, state] of this.stateCache) {
      healthMap.set(chainId, state.isHealthy);
    }
    
    return healthMap;
  }

  /**
   * Force mark a chain as healthy (for manual recovery)
   */
  markChainHealthy(chainId: number): void {
    this.updateState(chainId, {
      isHealthy: true,
      errorCount: 0,
      lastError: undefined
    });
    
    this.logger.info(`Manually marked chain ${chainId} as healthy`);
  }
} 