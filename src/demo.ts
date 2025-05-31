import dotenv from 'dotenv';
import { BaseIndexer } from '@/core/base-indexer';
import { loadConfig, validateConfig } from '@/utils/config';
import type { EventHandler, EventContext, LogData } from '@/types';

// Load environment variables
dotenv.config();

// Example event handler for demonstration
class EventCreatedHandler implements EventHandler {
  eventName = 'EventCreated';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    // For demonstration, we'll just log the event since creating an Event requires a User
    context.logger.info('EventCreated event detected', {
      eventName: this.eventName,
      chainId: context.chainId,
      blockNumber: context.blockNumber.toString(),
      transactionHash: context.transactionHash,
      logIndex: context.logIndex,
      contractAddress: log.address
    });
  }
}

// Another example handler
class UserRegisteredHandler implements EventHandler {
  eventName = 'UserRegistered';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      // Check if user already exists
      const existingUser = await context.prisma.user.findUnique({
        where: { address: log.address }
      });

      if (existingUser) {
        context.logger.debug('User already exists', {
          address: log.address,
          chainId: context.chainId
        });
        return;
      }

      const user = await context.prisma.user.create({
        data: {
          address: log.address // This field exists in User schema
        }
      });

      context.logger.info('UserRegistered processed', {
        userId: user.id,
        chainId: context.chainId,
        address: user.address
      });

    } catch (error) {
      context.logger.error('Failed to create User record', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });
      throw error;
    }
  }
}

async function main() {
  console.log('🎯 Starting Assemble Protocol Indexer Demo...\n');

  try {
    // Load and validate configuration
    const config = loadConfig();
    validateConfig(config);
    
    console.log('✅ Configuration loaded and validated');
    console.log(`📊 Chains: ${config.chains.map(c => c.name).join(', ')}`);
    console.log(`📝 Log level: ${config.logging.level}`);
    console.log(`🔄 Max retries: ${config.retry.maxRetries}\n`);

    // Create the indexer
    const indexer = new BaseIndexer(config);

    // Register event handlers
    indexer.registerEventHandler(new EventCreatedHandler());
    indexer.registerEventHandler(new UserRegisteredHandler());
    
    console.log('✅ Event handlers registered\n');

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Received shutdown signal...');
      await indexer.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start the indexer
    await indexer.start();

    // Set up periodic status reporting
    setInterval(async () => {
      try {
        const metrics = await indexer.getMetrics();
        const healthStatus = await indexer.getHealthStatus();
        
        console.log('\n📊 === INDEXER STATUS ===');
        console.log(`⏱️  Uptime: ${Math.floor(metrics.uptime / 1000)}s`);
        console.log(`🏗️  Blocks processed: ${metrics.blocksProcessed}`);
        console.log(`⚡ Events processed: ${metrics.eventsProcessed}`);
        console.log(`🌐 RPC calls: ${metrics.rpcCallsCount}`);
        console.log(`💾 Database writes: ${metrics.databaseWrites}`);
        console.log(`🔥 Errors: ${metrics.errorsEncountered}`);
        console.log(`⚡ Avg processing time: ${Math.round(metrics.averageBlockProcessingTime)}ms`);
        console.log(`🏥 Overall health: ${healthStatus.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        
        console.log('\n🔗 Chain Status:');
        for (const chain of healthStatus.chains) {
          const status = chain.isHealthy ? '✅' : '❌';
          const connection = chain.connectionStatus.hasWebSocket ? 'WS' : 'HTTP';
          console.log(`  ${status} ${chain.name} (${chain.chainId}): Block ${chain.lastBlock} [${connection}]`);
        }
        console.log('========================\n');
        
      } catch (error) {
        console.error('❌ Failed to get status:', (error as Error).message);
      }
    }, 30000); // Report every 30 seconds

    // Keep the process running
    console.log('🚀 Indexer is running! Press Ctrl+C to stop gracefully.\n');
    console.log('📊 Status will be reported every 30 seconds...\n');

    // Wait indefinitely
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Demo failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

// Run the demo
main(); 