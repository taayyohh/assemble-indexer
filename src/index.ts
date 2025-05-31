import dotenv from 'dotenv';
import { BaseIndexer } from '@/core/base-indexer';
import { loadConfig, validateConfig } from '@/utils/config';
import * as handlers from '@/handlers';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting Production Assemble Protocol Indexer...\n');

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

    // Register ALL 26 event handlers
    console.log('🔧 Registering all event handlers...\n');
    
    const handlerInstances = [
      // Core Event Handlers
      new handlers.EventCreatedHandler(),
      new handlers.EventCancelledHandler(),
      new handlers.EventTippedHandler(),
      
      // Ticket System Handlers
      new handlers.TicketPurchasedHandler(),
      new handlers.TicketUsedHandler(),
      new handlers.AttendanceVerifiedHandler(),
      
      // Social Features Handlers
      new handlers.FriendAddedHandler(),
      new handlers.FriendRemovedHandler(),
      new handlers.RSVPUpdatedHandler(),
      new handlers.CommentPostedHandler(),
      new handlers.CommentDeletedHandler(),
      new handlers.CommentLikedHandler(),
      new handlers.CommentUnlikedHandler(),
      
      // Invitation System Handlers
      new handlers.UserInvitedHandler(),
      new handlers.InvitationRevokedHandler(),
      
      // Financial Handlers
      new handlers.RefundClaimedHandler(),
      new handlers.FundsClaimedHandler(),
      new handlers.PaymentAllocatedHandler(),
      new handlers.PlatformFeeAllocatedHandler(),
      
      // Administrative Handlers
      new handlers.FeeToUpdatedHandler(),
      new handlers.ProtocolFeeUpdatedHandler(),
      
      // Moderation Handlers
      new handlers.UserBannedHandler(),
      new handlers.UserUnbannedHandler(),
      
      // ERC-6909 Standard Handlers
      new handlers.ApprovalHandler(),
      new handlers.TransferHandler(),
      new handlers.OperatorSetHandler()
    ];

    // Register each handler and log it
    handlerInstances.forEach((handler, index) => {
      indexer.registerEventHandler(handler);
      console.log(`${index + 1}. ✅ ${handler.eventName} Handler registered`);
    });

    console.log(`\n🎯 ALL ${handlerInstances.length} HANDLERS REGISTERED SUCCESSFULLY!\n`);
    
    // Verify we have 26 handlers (complete protocol coverage)
    if (handlerInstances.length !== 26) {
      throw new Error(`Expected 26 handlers, but only registered ${handlerInstances.length}`);
    }

    console.log('📋 Handler Categories:');
    console.log('  🎪 Core Events: EventCreated, EventCancelled, EventTipped');
    console.log('  🎫 Ticket System: TicketPurchased, TicketUsed, AttendanceVerified');
    console.log('  👥 Social Features: Friend*, Comment*, RSVPUpdated');
    console.log('  📨 Invitations: UserInvited, InvitationRevoked');
    console.log('  💰 Financial: Refund*, Funds*, Payment*, PlatformFee*');
    console.log('  ⚙️  Administrative: FeeToUpdated, ProtocolFeeUpdated');
    console.log('  🚫 Moderation: UserBanned, UserUnbanned');
    console.log('  🏆 ERC-6909: Transfer, Approval, OperatorSet\n');

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Received shutdown signal...');
      await indexer.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log('🚀 Starting production indexer with full protocol coverage...\n');
    
    // Start the indexer
    await indexer.start();

  } catch (error) {
    console.error('❌ Production indexer failed to start:', error);
    process.exit(1);
  }
}

main(); 