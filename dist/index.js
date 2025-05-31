"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const base_indexer_1 = require("./core/base-indexer");
const config_1 = require("./utils/config");
const handlers = __importStar(require("./handlers"));
// Load environment variables
dotenv_1.default.config();
async function main() {
    console.log('🚀 Starting Production Assemble Protocol Indexer...\n');
    try {
        // Load and validate configuration
        const config = (0, config_1.loadConfig)();
        (0, config_1.validateConfig)(config);
        console.log('✅ Configuration loaded and validated');
        console.log(`📊 Chains: ${config.chains.map(c => c.name).join(', ')}`);
        console.log(`📝 Log level: ${config.logging.level}`);
        console.log(`🔄 Max retries: ${config.retry.maxRetries}\n`);
        // Create the indexer
        const indexer = new base_indexer_1.BaseIndexer(config);
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
    }
    catch (error) {
        console.error('❌ Production indexer failed to start:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map