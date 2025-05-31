import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Assemble Indexer starting...');
  
  // Test database connection
  try {
    console.log('📊 Testing database connection...');
    
    // Simple test query to verify connection
    const indexerStates = await prisma.indexerState.findMany();
    console.log(`✅ Database connected! Found ${indexerStates.length} indexer states`);
    
    console.log('🎯 Setup validation complete!');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 