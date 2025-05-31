#!/usr/bin/env node

/**
 * Multi-Chain Assemble Protocol Indexer
 * 
 * Runs multiple blockchain indexers in parallel based on the CHAINS environment variable.
 * This allows starting all production chains with a single PM2 process.
 * 
 * Uses the same configuration system as the main indexer for consistency.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { loadConfig, validateConfig } from './utils/config';
import type { ChainConfig } from './types';

// Load environment variables
require('dotenv').config();

class MultiChainIndexer {
  private processes: Map<number, ChildProcess> = new Map();
  private isShuttingDown = false;
  private config: ReturnType<typeof loadConfig>;

  constructor() {
    this.setupSignalHandlers();
    
    try {
      this.config = loadConfig();
      validateConfig(this.config);
    } catch (error) {
      console.error('❌ Configuration error:', (error as Error).message);
      process.exit(1);
    }
  }

  async start(): Promise<void> {
    const chainsToRun = this.getChainsToRun();
    
    if (chainsToRun.length === 0) {
      console.error('❌ No valid chains configured. Set CHAINS environment variable.');
      console.error('Available chains: ethereum, world-chain, flow-evm, sepolia');
      console.error('Example: CHAINS=world-chain,flow-evm');
      process.exit(1);
    }

    console.log('🚀 Starting Multi-Chain Assemble Protocol Indexer');
    console.log('═'.repeat(60));
    console.log(`📊 Chains to index: ${chainsToRun.map(c => c.name).join(', ')}`);
    console.log('');

    // Start all chain indexers in parallel
    const startPromises = chainsToRun.map(chain => this.startChainIndexer(chain));
    
    try {
      await Promise.all(startPromises);
      console.log('✅ All chain indexers started successfully');
      
      // Keep the process alive and monitor child processes
      this.monitorProcesses();
      
    } catch (error) {
      console.error('❌ Failed to start chain indexers:', error);
      process.exit(1);
    }
  }

  private getChainsToRun(): ChainConfig[] {
    const chainsEnv = process.env.CHAINS || '';
    const chainNames = chainsEnv.split(',').map(c => c.trim()).filter(Boolean);
    
    if (chainNames.length === 0) {
      console.warn('⚠️  CHAINS environment variable is empty or not set');
      return [];
    }

    const selectedChains: ChainConfig[] = [];
    
    for (const chainName of chainNames) {
      const chain = this.getChainByName(chainName);
      if (chain) {
        selectedChains.push(chain);
      } else {
        console.warn(`⚠️  Skipping invalid chain: ${chainName}`);
        console.warn(`   Available chains: ${this.getAvailableChainNames().join(', ')}`);
      }
    }
    
    return selectedChains;
  }

  private getChainByName(chainName: string): ChainConfig | null {
    // Normalize chain names to support common variants
    const normalizedName = chainName.toLowerCase().replace(/[-_\s]/g, '');
    
    return this.config.chains.find(chain => {
      const normalizedChainName = chain.name.toLowerCase().replace(/[-_\s]/g, '');
      
      // Support multiple name variants
      const variants = [
        normalizedChainName,
        normalizedChainName.replace('mainnet', ''),
        normalizedChainName.replace('testnet', ''),
        normalizedChainName.replace('evm', ''),
        normalizedChainName.replace('chain', '')
      ];
      
      return variants.includes(normalizedName) || 
             chain.chainId.toString() === chainName; // Support chain ID as name
    }) || null;
  }

  private getAvailableChainNames(): string[] {
    return this.config.chains.map(chain => {
      const baseName = chain.name.toLowerCase()
        .replace('mainnet', '')
        .replace('testnet', '')
        .replace(/\s+/g, '-')
        .trim();
      
      return baseName;
    });
  }

  private async startChainIndexer(chain: ChainConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔗 Starting ${chain.name} indexer...`);
      
      const indexerPath = path.join(process.cwd(), 'dist', 'index.js');
      
      // Spawn the single-chain indexer with chain-specific environment
      const childProcess = spawn('node', [indexerPath], {
        env: {
          ...process.env,
          // Override with single-chain configuration
          CHAIN_ID: chain.chainId.toString(),
          CHAIN_NAME: chain.name,
          RPC_URL: chain.rpcUrl,
          WS_URL: chain.wsUrl || '',
          CONTRACT_ADDRESS: chain.contractAddress,
          START_BLOCK: chain.startBlock.toString(),
          BLOCK_POLLING_INTERVAL: chain.blockPollingInterval.toString(),
          LOG_LEVEL: process.env.LOG_LEVEL || 'info'
        },
        stdio: ['inherit', 'pipe', 'pipe']
      });

      // Prefix logs with chain name
      childProcess.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          console.log(`[${chain.name.toUpperCase().replace(/\s+/g, '-')}] ${message}`);
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          console.error(`[${chain.name.toUpperCase().replace(/\s+/g, '-')}] ${message}`);
        }
      });

      childProcess.on('spawn', () => {
        console.log(`✅ ${chain.name} indexer spawned (PID: ${childProcess.pid})`);
        this.processes.set(chain.chainId, childProcess);
        resolve();
      });

      childProcess.on('error', (error) => {
        console.error(`❌ ${chain.name} indexer failed to start:`, error);
        reject(error);
      });

      childProcess.on('exit', (code, signal) => {
        console.log(`⚠️  ${chain.name} indexer exited (code: ${code}, signal: ${signal})`);
        this.processes.delete(chain.chainId);
        
        // If not shutting down and exit was unexpected, restart
        if (!this.isShuttingDown && code !== 0) {
          console.log(`🔄 Restarting ${chain.name} indexer...`);
          setTimeout(() => {
            this.startChainIndexer(chain).catch(console.error);
          }, 5000);
        }
      });
    });
  }

  private monitorProcesses(): void {
    // Check process health every 30 seconds
    setInterval(() => {
      if (this.isShuttingDown) return;
      
      const runningChains = Array.from(this.processes.entries()).map(([chainId]) => {
        const chain = this.config.chains.find(c => c.chainId === chainId);
        return chain?.name || `Chain-${chainId}`;
      });
      
      if (runningChains.length > 0) {
        console.log(`💓 Health check: ${runningChains.length} chains running (${runningChains.join(', ')})`);
      } else {
        console.warn('⚠️  No chain indexers running!');
      }
    }, 30000);

    // Keep process alive
    process.stdin.resume();
  }

  private setupSignalHandlers(): void {
    const shutdown = (signal: string) => {
      if (this.isShuttingDown) return;
      
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      this.isShuttingDown = true;
      
      // Kill all child processes
      for (const [chainId, childProcess] of this.processes) {
        const chain = this.config.chains.find(c => c.chainId === chainId);
        const chainName = chain?.name || `Chain-${chainId}`;
        console.log(`🔄 Stopping ${chainName} indexer...`);
        childProcess.kill('SIGTERM');
      }
      
      // Give processes time to shutdown gracefully
      setTimeout(() => {
        console.log('✅ Multi-chain indexer shutdown complete');
        process.exit(0);
      }, 5000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  }
}

// Start the multi-chain indexer
const indexer = new MultiChainIndexer();
indexer.start().catch((error) => {
  console.error('❌ Multi-chain indexer failed:', error);
  process.exit(1);
}); 