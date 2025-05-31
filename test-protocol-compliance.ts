#!/usr/bin/env tsx

/**
 * 🎯 Assemble Protocol Compliance Test Suite
 * 
 * This script validates:
 * 1. All 26 Assemble Protocol events are properly handled
 * 2. ERC-6909 standard compliance 
 * 3. Database schema coverage
 * 4. Event decoding accuracy
 */

import fs from 'fs';
import path from 'path';

// Import our ABI decoder to validate against protocol
const ASSEMBLE_ABI_PATH = './node_modules/@imaginarylabs/assemble/out/Assemble.sol/Assemble.json';
const HANDLERS_DIR = './src/handlers';

interface ProtocolEvent {
  name: string;
  type: 'event';
  inputs: Array<{
    name: string;
    type: string;
    indexed: boolean;
  }>;
}

interface TestResult {
  passed: boolean;
  message: string;
  details?: any;
}

interface ComplianceResult {
  event: string;
  compliant: boolean;
  details: string;
}

class ProtocolComplianceTest {
  private protocolEvents: ProtocolEvent[] = [];
  private implementedHandlers: string[] = [];
  private testResults: TestResult[] = [];

  async run(): Promise<void> {
    console.log('🎯 Starting Assemble Protocol Compliance Test Suite\n');
    
    // Test 1: Load Protocol ABI
    await this.loadProtocolABI();
    
    // Test 2: Discover Implemented Handlers
    await this.discoverHandlers();
    
    // Test 3: Validate Event Coverage
    await this.validateEventCoverage();
    
    // Test 4: Validate ERC-6909 Compliance
    await this.validateERC6909Compliance();
    
    // Test 5: Validate ABI Decoder
    await this.validateABIDecoder();
    
    // Test 6: Database Schema Coverage
    await this.validateDatabaseSchema();
    
    // Test 7: Handler Implementation Quality
    await this.validateHandlerQuality();
    
    // Generate Report
    this.generateReport();
  }

  private async loadProtocolABI(): Promise<void> {
    try {
      const abiFile = fs.readFileSync(ASSEMBLE_ABI_PATH, 'utf8');
      const abiData = JSON.parse(abiFile);
      
      // Handle Forge format - ABI is nested under "abi" key
      const abi = abiData.abi || abiData;
      
      // Filter for events only
      this.protocolEvents = abi.filter(
        (item: any) => item.type === 'event'
      ) as ProtocolEvent[];
      
      console.log(`📋 Loaded ${this.protocolEvents.length} protocol events from ABI`);
      console.log('Events found:', this.protocolEvents.map(e => e.name).sort().join(', '));
    } catch (error) {
      throw new Error(`Failed to load protocol ABI: ${(error as Error).message}`);
    }
  }

  private async discoverHandlers(): Promise<void> {
    try {
      const handlerFiles = fs.readdirSync(HANDLERS_DIR)
        .filter(file => file.endsWith('Handler.ts') && file !== 'index.ts')
        .map(file => file.replace('Handler.ts', ''));
      
      this.implementedHandlers = handlerFiles;
      
      this.testResults.push({
        passed: true,
        message: `✅ Discovered ${handlerFiles.length} implemented handlers`,
        details: handlerFiles.sort()
      });
    } catch (error) {
      this.testResults.push({
        passed: false,
        message: '❌ Failed to discover handlers',
        details: (error as Error).message
      });
    }
  }

  private async validateEventCoverage(): Promise<void> {
    const protocolEventNames = this.protocolEvents.map(e => e.name).sort();
    const implementedEventNames = this.implementedHandlers.sort();
    
    const missing = protocolEventNames.filter(name => !implementedEventNames.includes(name));
    const extra = implementedEventNames.filter(name => !protocolEventNames.includes(name));
    
    const coveragePercent = Math.round((implementedEventNames.length / protocolEventNames.length) * 100);
    
    this.testResults.push({
      passed: missing.length === 0,
      message: `${missing.length === 0 ? '✅' : '⚠️'} Event Coverage: ${coveragePercent}% (${implementedEventNames.length}/${protocolEventNames.length})`,
      details: {
        missing,
        extra,
        implemented: implementedEventNames,
        protocol: protocolEventNames
      }
    });
  }

  private async validateERC6909Compliance(): Promise<void> {
    // ERC-6909 Standard Events according to the specification
    const erc6909Events = ['Transfer', 'Approval', 'OperatorSet'];
    
    const implementedERC6909 = this.protocolEvents.filter(event => 
      erc6909Events.includes(event.name)
    );
    
    // Find specific events
    const transferEvent = this.protocolEvents.find(e => e.name === 'Transfer');
    const approvalEvent = this.protocolEvents.find(e => e.name === 'Approval');
    const operatorSetEvent = this.protocolEvents.find(e => e.name === 'OperatorSet');
    
    const complianceResults: ComplianceResult[] = [];
    
    // Check Transfer event signature according to ERC-6909
    if (transferEvent) {
      const hasCallerParam = transferEvent.inputs.some(i => i.name === 'caller');
      const hasCorrectParams = transferEvent.inputs.length === 5;
      const expectedParams = ['caller', 'sender', 'receiver', 'id', 'amount'];
      const actualParams = transferEvent.inputs.map(i => i.name);
      
      complianceResults.push({
        event: 'Transfer',
        compliant: hasCallerParam && hasCorrectParams && 
                  expectedParams.every(param => actualParams.includes(param)),
        details: `Expected params: [${expectedParams.join(', ')}], found: [${actualParams.join(', ')}]`
      });
    }
    
    // Check Approval event signature according to ERC-6909
    if (approvalEvent) {
      const hasIdParam = approvalEvent.inputs.some(i => i.name === 'id');
      const hasCorrectParams = approvalEvent.inputs.length === 4;
      const expectedParams = ['owner', 'spender', 'id', 'amount'];
      const actualParams = approvalEvent.inputs.map(i => i.name);
      
      complianceResults.push({
        event: 'Approval',
        compliant: hasIdParam && hasCorrectParams && 
                  expectedParams.every(param => actualParams.includes(param)),
        details: `Expected params: [${expectedParams.join(', ')}], found: [${actualParams.join(', ')}]`
      });
    }
    
    // Check OperatorSet event signature according to ERC-6909  
    if (operatorSetEvent) {
      const hasApprovedParam = operatorSetEvent.inputs.some(i => i.name === 'approved');
      const hasCorrectParams = operatorSetEvent.inputs.length === 3;
      const expectedParams = ['owner', 'spender', 'approved'];
      const actualParams = operatorSetEvent.inputs.map(i => i.name);
      
      complianceResults.push({
        event: 'OperatorSet',
        compliant: hasApprovedParam && hasCorrectParams && 
                  expectedParams.every(param => actualParams.includes(param)),
        details: `Expected params: [${expectedParams.join(', ')}], found: [${actualParams.join(', ')}]`
      });
    }
    
    const allCompliant = complianceResults.every(r => r.compliant);
    
    this.testResults.push({
      passed: allCompliant && implementedERC6909.length === 3,
      message: `${allCompliant ? '✅' : '❌'} ERC-6909 Compliance: ${implementedERC6909.length}/3 events implemented`,
      details: complianceResults
    });
  }

  private async validateABIDecoder(): Promise<void> {
    try {
      // Import and test our ABI decoder
      const { AssembleABIDecoder } = await import('./src/utils/abi-decoder');
      const decoder = new AssembleABIDecoder();
      
      const supportedEvents = decoder.getSupportedEvents();
      const protocolEventNames = this.protocolEvents.map(e => e.name);
      
      const decoderCoverage = supportedEvents.filter(event => 
        protocolEventNames.includes(event)
      );
      
      const coveragePercent = Math.round((decoderCoverage.length / protocolEventNames.length) * 100);
      
      this.testResults.push({
        passed: decoderCoverage.length === protocolEventNames.length,
        message: `${coveragePercent === 100 ? '✅' : '⚠️'} ABI Decoder Coverage: ${coveragePercent}% (${decoderCoverage.length}/${protocolEventNames.length})`,
        details: {
          supported: supportedEvents.sort(),
          missing: protocolEventNames.filter(name => !supportedEvents.includes(name))
        }
      });
    } catch (error) {
      this.testResults.push({
        passed: false,
        message: '❌ ABI Decoder validation failed',
        details: (error as Error).message
      });
    }
  }

  private async validateDatabaseSchema(): Promise<void> {
    try {
      // Check if Prisma schema covers all necessary models
      const schemaPath = './prisma/schema.prisma';
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      
      // Essential models for complete protocol coverage
      const requiredModels = [
        'User', 'Event', 'Ticket', 'Badge', 'Comment', 'Friend',
        'RSVP', 'Invitation', 'EventTip', 'CheckIn', 'ProcessedEvent'
      ];
      
      const foundModels = requiredModels.filter(model => 
        schemaContent.includes(`model ${model}`)
      );
      
      const coveragePercent = Math.round((foundModels.length / requiredModels.length) * 100);
      
      this.testResults.push({
        passed: foundModels.length === requiredModels.length,
        message: `${coveragePercent === 100 ? '✅' : '⚠️'} Database Schema Coverage: ${coveragePercent}% (${foundModels.length}/${requiredModels.length})`,
        details: {
          found: foundModels,
          missing: requiredModels.filter(model => !foundModels.includes(model))
        }
      });
    } catch (error) {
      this.testResults.push({
        passed: false,
        message: '❌ Database schema validation failed',
        details: (error as Error).message
      });
    }
  }

  private async validateHandlerQuality(): Promise<void> {
    const qualityIssues: string[] = [];
    
    // Check each handler for quality indicators
    for (const handler of this.implementedHandlers) {
      const handlerPath = path.join(HANDLERS_DIR, `${handler}Handler.ts`);
      
      if (fs.existsSync(handlerPath)) {
        const content = fs.readFileSync(handlerPath, 'utf8');
        
        // Check for proper error handling
        if (!content.includes('try {') || !content.includes('catch (error)')) {
          qualityIssues.push(`${handler}: Missing proper error handling`);
        }
        
        // Check for user auto-creation pattern
        if (content.includes('user') && !content.includes('findUnique') && !content.includes('create')) {
          qualityIssues.push(`${handler}: Missing user auto-creation pattern`);
        }
        
        // Check for proper logging
        if (!content.includes('context.logger.info')) {
          qualityIssues.push(`${handler}: Missing info logging`);
        }
        
        // Check for proper event context usage
        if (!content.includes('chainId') || !content.includes('transactionHash')) {
          qualityIssues.push(`${handler}: Incomplete event context usage`);
        }
      }
    }
    
    this.testResults.push({
      passed: qualityIssues.length === 0,
      message: `${qualityIssues.length === 0 ? '✅' : '⚠️'} Handler Quality: ${qualityIssues.length} issues found`,
      details: qualityIssues
    });
  }

  private generateReport(): void {
    console.log('\n📊 PROTOCOL COMPLIANCE TEST REPORT');
    console.log('═'.repeat(50));
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const overallScore = Math.round((passed / total) * 100);
    
    console.log(`\n🎯 Overall Score: ${overallScore}% (${passed}/${total} tests passed)\n`);
    
    this.testResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.message}`);
      if (!result.passed && result.details) {
        console.log(`   Details:`, result.details);
      }
      console.log();
    });
    
    // Specific recommendations
    console.log('🚀 RECOMMENDATIONS FOR 100% PROTOCOL PARITY:');
    console.log('─'.repeat(50));
    
    const eventCoverageResult = this.testResults.find(r => r.message.includes('Event Coverage'));
    if (eventCoverageResult && !eventCoverageResult.passed) {
      const missing = eventCoverageResult.details?.missing || [];
      if (missing.length > 0) {
        console.log('\n📝 Missing Event Handlers:');
        missing.forEach((event: string) => {
          console.log(`   • ${event}Handler.ts - Implement handler for ${event} event`);
        });
      }
    }
    
    console.log('\n🔍 TESTING COMMANDS:');
    console.log('─'.repeat(30));
    console.log('• Run this test: tsx test-protocol-compliance.ts');
    console.log('• Test ABI decoding: tsx src/utils/test-abi-decoder.ts');
    console.log('• Validate database: pnpm db:generate && pnpm db:push');
    console.log('• Run indexer: pnpm dev');
    
    // Exit with proper code
    process.exit(overallScore === 100 ? 0 : 1);
  }
}

// Run the test suite
new ProtocolComplianceTest().run().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
}); 