# 🚀 Assemble Protocol Indexer

Production-ready blockchain indexer for Assemble Protocol with **100% protocol coverage** across multiple chains.

## ✅ **Complete Protocol Parity**
- **26/26 handlers** (100% coverage)
- **Perfect ABI alignment** (100%)
- **Complete functionality testing** (100%)
- **ERC-6909 compliance** ✅
- **Multi-chain support** ✅

## 🎯 **Simple Deployment**

### **Production (All chains: Ethereum + World + Flow)**
```bash
pm2 start assemble-indexer
```

### **Development**
```bash
pm2 start assemble-dev-mode
```

### **Testnet (Sepolia)**
```bash
pm2 start assemble-indexer-sepolia
```

## 🔧 **Environment Setup**

Copy and configure:
```bash
cp env.example .env
```

Required variables:
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/assemble_indexer"

# Production Chains
ETHEREUM_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
ETHEREUM_CONTRACT_ADDRESS="0xYourContractAddress"
WORLD_RPC_URL="https://worldchain-mainnet.g.alchemy.com/v2/YOUR_KEY" 
WORLD_CONTRACT_ADDRESS="0xYourContractAddress"
FLOW_RPC_URL="https://mainnet.evm.nodes.onflow.org"
FLOW_CONTRACT_ADDRESS="0xYourContractAddress"
```

## 🏭 **Deployment Steps**

1. **On your server:**
   ```bash
   git pull
   pnpm install
   pnpm build
   pm2 start assemble-indexer
   ```

2. **Monitor:**
   ```bash
   pm2 status
   pm2 logs assemble-indexer
   ```

## 📊 **Monitoring**

```bash
pm2 status                  # View all processes
pm2 logs assemble-indexer   # View logs (all chains)
pm2 monit                   # Real-time monitoring
pm2 restart assemble-indexer # Restart if needed
```

## 🔍 **Validation**

Run complete audit suite:
```bash
pnpm audit:all
```

## 🎉 **Features**

- **Single Command Deployment** - `pm2 start assemble-indexer`
- **Multi-Chain Support** - Ethereum, World Chain, Flow EVM
- **Auto-Restart** - Automatic recovery from failures
- **Health Monitoring** - Built-in health checks
- **100% Protocol Coverage** - Every Assemble Protocol event handled

---

**Your blockchain indexing is now as simple as starting a single service!** 🚀 