#!/usr/bin/env node

/**
 * Multi-Chain Assemble Protocol Indexer
 * 
 * Runs multiple blockchain indexers in parallel based on the CHAINS environment variable.
 * This allows starting all production chains with a single PM2 process.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface ChainConfig {
  chainId: string;
  chainName: string;
  rpcUrl: string;
  contractAddress: string;
  startBlock: string;
}

class MultiChainIndexer {
  private processes: Map<string, ChildProcess> = new Map();
  private isShuttingDown = false;

  constructor() {
    this.setupSignalHandlers();
  }

  async start(): Promise<void> {
    const chainsToRun = this.getChainsToRun();
    
    if (chainsToRun.length === 0) {
      console.error('❌ No valid chains configured. Set CHAINS environment variable.');
      process.exit(1);
    }

    console.log('🚀 Starting Multi-Chain Assemble Protocol Indexer');
    console.log('═'.repeat(60));
    console.log(`📊 Chains to index: ${chainsToRun.map(c => c.chainName).join(', ')}`);
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
    
    const configs: ChainConfig[] = [];
    
    for (const chainName of chainNames) {
      const config = this.getChainConfig(chainName);
      if (config) {
        configs.push(config);
      } else {
        console.warn(`⚠️  Skipping invalid chain: ${chainName}`);
      }
    }
    
    return configs;
  }

  private getChainConfig(chainName: string): ChainConfig | null {
    const chainConfigs: Record<string, Partial<ChainConfig>> = {
      ethereum: {
        chainId: '1',
        chainName: 'ethereum',
        rpcUrl: process.env.ETHEREUM_RPC_URL,
        contractAddress: process.env.ETHEREUM_CONTRACT_ADDRESS,
        startBlock: process.env.ETHEREUM_START_BLOCK || '0'
      },
      world: {
        chainId: '480',
        chainName: 'world',
        rpcUrl: process.env.WORLD_RPC_URL,
        contractAddress: process.env.WORLD_CONTRACT_ADDRESS,
        startBlock: process.env.WORLD_START_BLOCK || '0'
      },
      flow: {
        chainId: '747',
        chainName: 'flow-evm',
        rpcUrl: process.env.FLOW_RPC_URL,
        contractAddress: process.env.FLOW_CONTRACT_ADDRESS,
        startBlock: process.env.FLOW_START_BLOCK || '0'
      },
      sepolia: {
        chainId: '11155111',
        chainName: 'sepolia',
        rpcUrl: process.env.SEPOLIA_RPC_URL,
        contractAddress: process.env.SEPOLIA_CONTRACT_ADDRESS,
        startBlock: process.env.SEPOLIA_START_BLOCK || '0'
      }
    };

    const config = chainConfigs[chainName];
    if (!config || !config.rpcUrl || !config.contractAddress) {
      return null;
    }

    return config as ChainConfig;
  }

  private async startChainIndexer(chain: ChainConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔗 Starting ${chain.chainName} indexer...`);
      
      const indexerPath = path.join(process.cwd(), 'dist', 'index.js');
      
      // Spawn the single-chain indexer with chain-specific environment
      const childProcess = spawn('node', [indexerPath], {
        env: {
          ...process.env,
          CHAIN_ID: chain.chainId,
          CHAIN_NAME: chain.chainName,
          RPC_URL: chain.rpcUrl,
          CONTRACT_ADDRESS: chain.contractAddress,
          START_BLOCK: chain.startBlock,
          LOG_LEVEL: process.env.LOG_LEVEL || 'info'
        },
        stdio: ['inherit', 'pipe', 'pipe']
      });

      // Prefix logs with chain name
      childProcess.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          console.log(`[${chain.chainName.toUpperCase()}] ${message}`);
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          console.error(`[${chain.chainName.toUpperCase()}] ${message}`);
        }
      });

      childProcess.on('spawn', () => {
        console.log(`✅ ${chain.chainName} indexer spawned (PID: ${childProcess.pid})`);
        this.processes.set(chain.chainName, childProcess);
        resolve();
      });

      childProcess.on('error', (error) => {
        console.error(`❌ ${chain.chainName} indexer failed to start:`, error);
        reject(error);
      });

      childProcess.on('exit', (code, signal) => {
        console.log(`⚠️  ${chain.chainName} indexer exited (code: ${code}, signal: ${signal})`);
        this.processes.delete(chain.chainName);
        
        // If not shutting down and exit was unexpected, restart
        if (!this.isShuttingDown && code !== 0) {
          console.log(`🔄 Restarting ${chain.chainName} indexer...`);
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
      
      const runningChains = Array.from(this.processes.keys());
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
      for (const [chainName, childProcess] of this.processes) {
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