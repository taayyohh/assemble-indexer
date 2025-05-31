# Assemble Protocol Indexer

A protocol-agnostic blockchain indexer built specifically for Assemble Protocol events. This indexer provides real-time event processing, GraphQL API with Relay support, and robust error handling with state recovery.

## Features

- **Protocol-Agnostic Core**: Reusable indexer infrastructure for any EVM-compatible blockchain
- **Multi-Chain Support**: Ethereum Mainnet, World Chain, Flow EVM, Sepolia Testnet
- **Real-time Event Processing**: WebSocket and HTTP polling with intelligent fallback
- **GraphQL API**: Relay-compatible schema for frontend consumption
- **Robust Error Handling**: Advanced retry mechanisms, circuit breakers, and state recovery
- **MongoDB + Prisma**: Type-safe database operations with automatic migrations
- **Production Ready**: Comprehensive logging, metrics, and monitoring

## Supported Events

### Core Protocol Events
- `EventCreated` - New event creation
- `EventUpdated` - Event metadata updates
- `TicketPurchased` - Ticket sales tracking
- `EventTipped` - Event creator tips
- `CheckedIn` variants - Attendance tracking

### Social Features
- `FriendAdded` - Social connections
- `RSVPUpdated` - RSVP status changes
- `CommentPosted` - Event comments with threading
- `InvitationSent` - Private event invitations

### ERC-6909 Multi-Token Events
- Ticket transfers and approvals
- Soulbound attendance badges (ERC-5192)

## Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd assemble-indexer
   pnpm install
   ```

2. **Environment Setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   pnpm db:generate
   pnpm db:push
   ```

4. **Start Development**
   ```bash
   pnpm dev
   ```

5. **Access GraphQL Playground**
   Open `http://localhost:4000/graphql` in your browser

## Architecture

```
src/
├── core/           # Protocol-agnostic indexer infrastructure
├── indexers/       # Assemble-specific event handlers
├── graphql/        # GraphQL schema and resolvers
├── types/          # TypeScript type definitions
└── utils/          # Utility functions and helpers

prisma/             # Database schema and migrations
scripts/            # Deployment and utility scripts
data/               # Persistent state and checkpoints
logs/               # Application logs
```

## Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:push` - Push schema to database
- `pnpm db:migrate` - Run database migrations
- `pnpm lint` - Lint TypeScript code
- `pnpm test` - Run test suite

## Configuration

See `env.example` for all available configuration options including:
- Database connection strings
- RPC endpoints for all supported chains
- Retry and circuit breaker settings
- Logging and metrics configuration

## License

MIT License - see LICENSE file for details 