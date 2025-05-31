import { PrismaClient } from '@prisma/client';

// ===== CORE TYPES =====

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  wsUrl?: string;
  startBlock: bigint;
  blockPollingInterval: number;
  contractAddress: string;
}

export interface IndexerConfig {
  chains: ChainConfig[];
  database: {
    url: string;
  };
  graphql: {
    port: number;
    endpoint: string;
  };
  retry: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    jitter: boolean;
  };
  circuitBreaker: {
    threshold: number;
    timeout: number;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    filePath: string;
  };
  metrics: {
    enabled: boolean;
    port: number;
  };
}

// ===== BLOCKCHAIN TYPES =====

export interface BlockData {
  number: bigint;
  hash: string;
  timestamp: number;
  parentHash: string;
}

export interface LogData {
  address: string;
  topics: string[];
  data: string;
  blockNumber: bigint;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  removed: boolean;
}

export interface ProcessedEvent {
  chainId: number;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
  eventName: string;
  data: Record<string, any>;
}

// ===== STATE MANAGEMENT =====

export interface IndexerState {
  chainId: number;
  lastBlock: bigint;
  lastUpdate: Date;
  isHealthy: boolean;
  errorCount: number;
  lastError?: string;
}

export interface Checkpoint {
  chainId: number;
  blockNumber: bigint;
  timestamp: Date;
  eventsProcessed: number;
}

// ===== RETRY & CIRCUIT BREAKER =====

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

// ===== METRICS & MONITORING =====

export interface IndexerMetrics {
  blocksProcessed: number;
  eventsProcessed: number;
  errorsEncountered: number;
  averageBlockProcessingTime: number;
  uptime: number;
  lastProcessedBlock: bigint;
  rpcCallsCount: number;
  databaseWrites: number;
}

export interface ChainMetrics {
  chainId: number;
  lastSyncedBlock: bigint;
  blocksBehind: number;
  eventsPerSecond: number;
  errorRate: number;
  isHealthy: boolean;
}

// ===== EVENT HANDLERS =====

export interface EventHandler<T = any> {
  eventName: string;
  handle(log: LogData, decodedData: T, context: EventContext): Promise<void>;
}

export interface EventContext {
  chainId: number;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
  prisma: PrismaClient;
  logger: Logger;
}

// ===== LOGGER =====

export interface Logger {
  error(message: string, extra?: Record<string, any>): void;
  warn(message: string, extra?: Record<string, any>): void;
  info(message: string, extra?: Record<string, any>): void;
  debug(message: string, extra?: Record<string, any>): void;
}

// ===== BASE INDEXER =====

export interface BaseIndexerInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  getState(chainId: number): Promise<IndexerState | null>;
  getMetrics(): Promise<IndexerMetrics>;
  isHealthy(): Promise<boolean>;
}

// ===== ERROR TYPES =====

export class IndexerError extends Error {
  public readonly code: string;
  public readonly chainId?: number;
  public readonly blockNumber?: bigint;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    retryable: boolean = true,
    chainId?: number,
    blockNumber?: bigint
  ) {
    super(message);
    this.name = 'IndexerError';
    this.code = code;
    this.chainId = chainId;
    this.blockNumber = blockNumber;
    this.retryable = retryable;
  }
}

export class RpcError extends IndexerError {
  constructor(message: string, chainId: number, blockNumber?: bigint) {
    super(message, 'RPC_ERROR', true, chainId, blockNumber);
    this.name = 'RpcError';
  }
}

export class DatabaseError extends IndexerError {
  constructor(message: string, chainId?: number, blockNumber?: bigint) {
    super(message, 'DATABASE_ERROR', true, chainId, blockNumber);
    this.name = 'DatabaseError';
  }
}

export class CircuitBreakerOpenError extends IndexerError {
  constructor(chainId: number) {
    super('Circuit breaker is open', 'CIRCUIT_BREAKER_OPEN', false, chainId);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ===== UTILITY TYPES =====

export type AsyncRetryFunction<T> = () => Promise<T>;

export interface BackoffOptions {
  factor: number;
  jitter: boolean;
  maxDelay: number;
} 