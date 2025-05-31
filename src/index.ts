import { PrismaClient } from '@prisma/client';
import { IndexerLogger } from '@/utils/logger';
import { RetryManager } from '@/core/retry-manager';
import { StateManager } from '@/core/state-manager';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Assemble Indexer starting...');
  
  // Initialize logger
  const logger = new IndexerLogger('info', './logs');
  logger.info('Indexer starting up');
  
  // Test database connection
  try {
    logger.info('Testing database connection');
    const indexerStates = await prisma.indexerState.findMany();
    logger.info(`Database connected! Found ${indexerStates.length} indexer states`);
    
    // Test RetryManager
    logger.info('Testing RetryManager');
    const retryManager = new RetryManager(
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 5000,
        jitter: true
      },
      5, // circuit breaker threshold
      30000, // circuit breaker timeout
      logger
    );
    
    // Test successful operation
    const testResult = await retryManager.executeWithRetry(
      async () => {
        logger.debug('Executing test operation');
        return 'success';
      },
      'test-operation'
    );
    logger.info(`RetryManager test result: ${testResult}`);
    
    // Test StateManager
    logger.info('Testing StateManager');
    const stateManager = new StateManager(prisma, logger, 5000); // 5 second checkpoints for testing
    
    const supportedChains = [1, 480, 747, 11155111];
    await stateManager.initializeStates(supportedChains);
    
    // Test state operations
    stateManager.recordBlockProcessed(1, BigInt(19000000));
    stateManager.recordBlockProcessed(480, BigInt(100));
    
    const ethereumState = stateManager.getState(1);
    logger.info('Ethereum state', {
      chainId: ethereumState?.chainId,
      lastBlock: ethereumState?.lastBlock.toString(),
      isHealthy: ethereumState?.isHealthy
    });
    
    // Test checkpoint
    await stateManager.createCheckpoint();
    logger.info('Checkpoint created successfully');
    
    // Test health status
    const healthStatus = stateManager.getHealthStatus();
    const healthSummary = Array.from(healthStatus.entries()).map(([chainId, isHealthy]) => ({
      chainId,
      isHealthy
    }));
    logger.info('Health status', { chains: healthSummary });
    
    // Graceful shutdown
    await stateManager.shutdown();
    logger.info('StateManager shutdown complete');
    
    logger.info('🎯 Core infrastructure validation complete!');
    
  } catch (error) {
    logger.error('Infrastructure test failed', { 
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 