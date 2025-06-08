#!/bin/bash

# Backup current .env
cp .env .env.backup-before-8chain

# Remove the non-protocol chains
sed -i '' '/WORLD_CHAIN_RPC_URL/d' .env
sed -i '' '/WORLD_CHAIN_WS_URL/d' .env
sed -i '' '/FLOW_EVM_RPC_URL/d' .env
sed -i '' '/FLOW_EVM_WS_URL/d' .env
sed -i '' '/START_BLOCK_WORLD_CHAIN/d' .env
sed -i '' '/START_BLOCK_FLOW_EVM/d' .env
sed -i '' '/CHAINS="ethereum,world-chain,flow-evm"/d' .env

# Add the 6 new protocol chains
cat >> .env << 'EOF'

# BASE MAINNET (Chain ID: 8453) - Public RPC
BASE_RPC_URL="https://base.llamarpc.com"
BASE_WS_URL=""
START_BLOCK_BASE=0

# BASE SEPOLIA (Chain ID: 84532) - Public RPC  
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
BASE_SEPOLIA_WS_URL=""
START_BLOCK_BASE_SEPOLIA=0

# OPTIMISM (Chain ID: 10) - Public RPC
OPTIMISM_RPC_URL="https://optimism.llamarpc.com" 
OPTIMISM_WS_URL=""
START_BLOCK_OPTIMISM=0

# ARBITRUM ONE (Chain ID: 42161) - Public RPC
ARBITRUM_RPC_URL="https://arbitrum.llamarpc.com"
ARBITRUM_WS_URL=""
START_BLOCK_ARBITRUM=0

# POLYGON (Chain ID: 137) - Public RPC
POLYGON_RPC_URL="https://polygon.llamarpc.com"
POLYGON_WS_URL=""
START_BLOCK_POLYGON=0

# ZORA (Chain ID: 7777777) - Public RPC
ZORA_RPC_URL="https://rpc.zora.energy"
ZORA_WS_URL=""
START_BLOCK_ZORA=0
EOF

echo "✅ Updated .env with all 8 protocol chains!"
echo "📊 Configured chains:"
echo "   1. Ethereum Mainnet (QuickNode)"
echo "   2. Sepolia Testnet (QuickNode)" 
echo "   3. Base Mainnet (Public RPC)"
echo "   4. Base Sepolia (Public RPC)"
echo "   5. Optimism (Public RPC)"
echo "   6. Arbitrum One (Public RPC)"
echo "   7. Polygon (Public RPC)"
echo "   8. Zora (Public RPC)" 