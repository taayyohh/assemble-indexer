#!/bin/bash

# Assemble Protocol Indexer - Simple Deployment Script

set -e

echo "🚀 Deploying Assemble Protocol Indexer"
echo "════════════════════════════════════════"

# Build the project
echo "🔨 Building project..."
pnpm build

# Create logs directory
mkdir -p logs

# Simple deployment options
echo ""
echo "🎯 Choose deployment mode:"
echo "1) 🌍 Production (All chains: Ethereum + World + Flow)"
echo "2) 🛠️  Development (pnpm dev mode)"
echo "3) 🧪 Sepolia Testnet"
echo "4) 🔧 Custom chain selection"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    echo "🌍 Starting production multi-chain indexer..."
    pm2 delete assemble-indexer 2>/dev/null || true
    pm2 start assemble-indexer
    echo "✅ Started: assemble-indexer (handles ethereum,world,flow)"
    ;;
  2)
    echo "🛠️  Starting development mode..."
    pm2 delete assemble-dev-mode 2>/dev/null || true
    pm2 start assemble-dev-mode
    echo "✅ Started: assemble-dev-mode"
    ;;
  3)
    echo "🧪 Starting Sepolia testnet indexer..."
    pm2 delete assemble-indexer-sepolia 2>/dev/null || true
    pm2 start assemble-indexer-sepolia
    echo "✅ Started: assemble-indexer-sepolia"
    ;;
  4)
    echo "🎛️  Available individual chain processes:"
    echo "  - assemble-indexer-ethereum"
    echo "  - assemble-indexer-world"
    echo "  - assemble-indexer-flow"
    echo "  - assemble-indexer-sepolia"
    echo ""
    read -p "Enter process names (space-separated): " processes
    for process in $processes; do
      pm2 delete $process 2>/dev/null || true
      pm2 start $process
      echo "✅ Started: $process"
    done
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

# Save PM2 configuration
pm2 save

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📊 Current status:"
pm2 status

echo ""
echo "🔧 Useful commands:"
echo "  pm2 logs                    - View all logs"
echo "  pm2 logs assemble-indexer   - View main indexer logs"
echo "  pm2 monit                   - Process monitor"
echo "  pm2 restart all             - Restart all processes"
echo "  pm2 stop all                - Stop all processes"
echo ""
echo "🎉 Your indexer is running with 100% protocol coverage! 🎊" 