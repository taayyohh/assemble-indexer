import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log('🌱 Seeding database...');
    // Initialize indexer states for all supported chains
    const chains = [
        { chainId: 1, name: 'Ethereum Mainnet' },
        { chainId: 480, name: 'World Chain' },
        { chainId: 747, name: 'Flow EVM' },
        { chainId: 11155111, name: 'Sepolia Testnet' }
    ];
    for (const chain of chains) {
        const existingState = await prisma.indexerState.findUnique({
            where: { chainId: chain.chainId }
        });
        if (!existingState) {
            await prisma.indexerState.create({
                data: {
                    chainId: chain.chainId,
                    lastBlock: BigInt(0),
                    isHealthy: true,
                    errorCount: 0
                }
            });
            console.log(`✅ Created indexer state for ${chain.name} (Chain ID: ${chain.chainId})`);
        }
        else {
            console.log(`⚡ Indexer state already exists for ${chain.name} (Chain ID: ${chain.chainId})`);
        }
    }
    // Create a sample user for testing
    const sampleUser = await prisma.user.upsert({
        where: { address: '0x1234567890123456789012345678901234567890' },
        update: {},
        create: {
            address: '0x1234567890123456789012345678901234567890',
            username: 'testuser',
            displayName: 'Test User',
            bio: 'Sample user for testing the Assemble Indexer'
        }
    });
    console.log(`👤 Sample user: ${sampleUser.displayName} (${sampleUser.address})`);
    console.log('🎉 Database seeding completed!');
}
main()
    .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map