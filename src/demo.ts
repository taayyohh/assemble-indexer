import dotenv from 'dotenv';
import { BaseIndexer } from '@/core/base-indexer';
import { loadConfig, validateConfig } from '@/utils/config';
import { EventCreatedHandler, TicketPurchasedHandler, FriendAddedHandler } from '@/handlers';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🎯 Starting Assemble Protocol Indexer with Full Event Support...\n');

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

    // Register production-ready event handlers with proper ABI decoding
    indexer.registerEventHandler(new EventCreatedHandler());
    indexer.registerEventHandler(new TicketPurchasedHandler());
    indexer.registerEventHandler(new FriendAddedHandler());
    
    console.log('✅ Production event handlers registered with ABI decoding\n');
    console.log('📋 Supported Events:');
    console.log('  🎪 EventCreated - Creates events with proper user management');
    console.log('  🎫 TicketPurchased - Tracks ticket sales and ownership');
    console.log('  👥 FriendAdded - Manages social connections');
    console.log('  📝 More handlers can be added following the same pattern\n');

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
        
        console.log('\n📊 === ASSEMBLE PROTOCOL INDEXER STATUS ===');
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
        
        console.log('\n🎯 Protocol Events Being Indexed:');
        console.log('  🎪 Event Creation & Management');
        console.log('  🎫 Ticket Sales & Transfers');
        console.log('  👥 Social Connections');
        console.log('  💰 Financial Transactions');
        console.log('  🏷️  Badge & Token Operations');
        console.log('========================\n');
        
      } catch (error) {
        console.error('❌ Failed to get status:', (error as Error).message);
      }
    }, 30000); // Report every 30 seconds

    // Keep the process running
    console.log('🚀 Assemble Protocol Indexer is running with full event support!');
    console.log('📊 Status will be reported every 30 seconds...');
    console.log('🔍 Monitoring contract: 0x00000004FE7c1E461A1703AF603F1A5F080Be253');
    console.log('💡 Press Ctrl+C to stop gracefully.\n');

    // Wait indefinitely
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Indexer failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

// Run the indexer
main(); 