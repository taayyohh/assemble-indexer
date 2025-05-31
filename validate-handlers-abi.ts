#!/usr/bin/env tsx

/**
 * 🔍 Handler-ABI-Schema Validation Suite
 * 
 * This script validates that every handler:
 * 1. Uses the exact parameter names from the ABI
 * 2. Maps correctly to the Prisma schema
 * 3. Handles all expected data transformations
 */

import fs from 'fs';
import path from 'path';

const ASSEMBLE_ABI_PATH = './node_modules/@imaginarylabs/assemble/out/Assemble.sol/Assemble.json';
const HANDLERS_DIR = './src/handlers';

interface AbiEvent {
  name: string;
  inputs: Array<{ name: string; type: string; indexed: boolean }>;
}

interface ValidationResult {
  handler: string;
  abiParametersMatch: boolean;
  expectedParams: string[];
  foundParams: string[];
  schemaMapping: boolean;
  issues: string[];
}

class HandlerABIValidator {
  private abiEvents: Map<string, AbiEvent> = new Map();
  private validationResults: ValidationResult[] = [];

  async run(): Promise<void> {
    console.log('🔍 Starting Handler-ABI-Schema Validation\n');
    
    // Load ABI events
    await this.loadABIEvents();
    
    // Validate each handler
    await this.validateAllHandlers();
    
    // Generate report
    this.generateReport();
  }

  private async loadABIEvents(): Promise<void> {
    const abiFile = fs.readFileSync(ASSEMBLE_ABI_PATH, 'utf8');
    const abiData = JSON.parse(abiFile);
    const events = abiData.abi.filter((item: any) => item.type === 'event');
    
    events.forEach((event: AbiEvent) => {
      this.abiEvents.set(event.name, event);
    });
    
    console.log(`📋 Loaded ${events.length} ABI events`);
  }

  private async validateAllHandlers(): Promise<void> {
    const handlerFiles = fs.readdirSync(HANDLERS_DIR)
      .filter(file => file.endsWith('Handler.ts') && file !== 'index.ts');

    for (const handlerFile of handlerFiles) {
      const eventName = handlerFile.replace('Handler.ts', '');
      const handlerPath = path.join(HANDLERS_DIR, handlerFile);
      
      await this.validateHandler(eventName, handlerPath);
    }
  }

  private async validateHandler(eventName: string, handlerPath: string): Promise<void> {
    const result: ValidationResult = {
      handler: eventName,
      abiParametersMatch: false,
      expectedParams: [],
      foundParams: [],
      schemaMapping: true,
      issues: []
    };

    try {
      // Get ABI event definition
      const abiEvent = this.abiEvents.get(eventName);
      if (!abiEvent) {
        result.issues.push(`No ABI event found for ${eventName}`);
        this.validationResults.push(result);
        return;
      }

      result.expectedParams = abiEvent.inputs.map(input => input.name);

      // Read handler file
      const handlerContent = fs.readFileSync(handlerPath, 'utf8');

      // Extract destructured parameters from handler
      const destructureMatch = handlerContent.match(/const\s*\{\s*([^}]+)\s*\}\s*=\s*decodedData/);
      if (!destructureMatch) {
        result.issues.push('No parameter destructuring found');
        this.validationResults.push(result);
        return;
      }

      // Parse found parameters
      result.foundParams = destructureMatch[1]
        .split(',')
        .map(param => param.trim())
        .filter(param => param.length > 0);

      // Check if parameters match
      const expectedSet = new Set(result.expectedParams);
      const foundSet = new Set(result.foundParams);
      
      result.abiParametersMatch = 
        expectedSet.size === foundSet.size &&
        [...expectedSet].every(param => foundSet.has(param));

      if (!result.abiParametersMatch) {
        const missing = result.expectedParams.filter(p => !foundSet.has(p));
        const extra = result.foundParams.filter(p => !expectedSet.has(p));
        
        if (missing.length > 0) {
          result.issues.push(`Missing ABI parameters: ${missing.join(', ')}`);
        }
        if (extra.length > 0) {
          result.issues.push(`Extra parameters: ${extra.join(', ')}`);
        }
      }

      // Validate schema mapping patterns
      await this.validateSchemaMapping(eventName, handlerContent, result);

    } catch (error) {
      result.issues.push(`Validation error: ${(error as Error).message}`);
    }

    this.validationResults.push(result);
  }

  private async validateSchemaMapping(eventName: string, content: string, result: ValidationResult): Promise<void> {
    // Check for common schema mapping patterns
    const checks = [
      {
        pattern: /address.*\.toLowerCase\(\)/,
        description: 'Address normalization',
        required: content.includes('address') && !['FeeToUpdated', 'ProtocolFeeUpdated'].includes(eventName)
      },
      {
        pattern: /findUnique|findFirst/,
        description: 'Database lookups',
        required: !['FeeToUpdated', 'ProtocolFeeUpdated'].includes(eventName)
      },
      {
        pattern: /\.toString\(\)/,
        description: 'BigInt conversion',
        required: content.includes('id') || content.includes('amount')
      }
    ];

    checks.forEach(check => {
      if (check.required && !check.pattern.test(content)) {
        result.issues.push(`Missing ${check.description} pattern`);
        result.schemaMapping = false;
      }
    });

    // Define which events should create new entities vs update existing ones
    const entityCreationEvents = [
      'EventCreated', 'TicketPurchased', 'CommentPosted', 'UserInvited', 
      'EventTipped', 'FriendAdded', 'RSVPUpdated', 'AttendanceVerified'
    ];

    const entityUpdateEvents = [
      'EventCancelled', 'TicketUsed', 'RefundClaimed', 'CommentDeleted',
      'CommentLiked', 'CommentUnliked', 'InvitationRevoked', 'FriendRemoved',
      'UserBanned', 'UserUnbanned'
    ];

    const financialLogEvents = [
      'FundsClaimed', 'PaymentAllocated', 'PlatformFeeAllocated'
    ];

    const configurationEvents = [
      'FeeToUpdated', 'ProtocolFeeUpdated'
    ];

    const erc6909Events = [
      'Transfer', 'Approval', 'OperatorSet'
    ];

    // Event-specific validations based on event type
    if (entityCreationEvents.includes(eventName)) {
      if (!content.includes('create(')) {
        result.issues.push(`${eventName} should create new entities`);
        result.schemaMapping = false;
      }
    }

    if (entityUpdateEvents.includes(eventName)) {
      if (!content.includes('update(') && !content.includes('updateMany(') && !content.includes('delete')) {
        result.issues.push(`${eventName} should update/delete existing entities`);
        result.schemaMapping = false;
      }
    }

    if (erc6909Events.includes(eventName)) {
      // ERC-6909 events primarily handle transfers/approvals, don't require entity creation
      if (!content.includes('user') && eventName !== 'OperatorSet') {
        result.issues.push(`${eventName} should ensure users exist for ERC-6909 compliance`);
        result.schemaMapping = false;
      }
    }

    // Financial and configuration events have different requirements
    if (financialLogEvents.includes(eventName) || configurationEvents.includes(eventName)) {
      // These events primarily log financial transactions or config changes
      // They may not need to create entities, just log the events
      result.schemaMapping = true; // Don't penalize these for not creating entities
    }

    // Event-specific validations
    switch (eventName) {
      case 'Transfer':
        if (!content.includes('badge') && !content.includes('ticket')) {
          result.issues.push('Transfer handler should handle badge/ticket transfers');
          result.schemaMapping = false;
        }
        break;
      
      case 'EventCreated':
        if (!content.includes('event') || !content.includes('creator')) {
          result.issues.push('EventCreated should create event with creator relationship');
          result.schemaMapping = false;
        }
        break;

      case 'TicketPurchased':
        if (!content.includes('ticket') || !content.includes('owner')) {
          result.issues.push('TicketPurchased should create ticket with owner relationship');
          result.schemaMapping = false;
        }
        break;

      case 'UserBanned':
      case 'UserUnbanned':
        if (!content.includes('bannedBy') && !content.includes('unbannedBy')) {
          result.issues.push('Ban/unban events should track who performed the action');
          result.schemaMapping = false;
        }
        break;
    }
  }

  private generateReport(): void {
    console.log('\n🔍 HANDLER-ABI-SCHEMA VALIDATION REPORT');
    console.log('═'.repeat(60));

    const totalHandlers = this.validationResults.length;
    const perfectMatches = this.validationResults.filter(r => 
      r.abiParametersMatch && r.schemaMapping && r.issues.length === 0
    ).length;
    const parameterMatches = this.validationResults.filter(r => r.abiParametersMatch).length;
    const schemaMappings = this.validationResults.filter(r => r.schemaMapping).length;

    console.log(`\n📊 SUMMARY:`);
    console.log(`• Total Handlers: ${totalHandlers}`);
    console.log(`• Perfect Matches: ${perfectMatches}/${totalHandlers} (${Math.round(perfectMatches/totalHandlers*100)}%)`);
    console.log(`• ABI Parameter Matches: ${parameterMatches}/${totalHandlers} (${Math.round(parameterMatches/totalHandlers*100)}%)`);
    console.log(`• Schema Mappings: ${schemaMappings}/${totalHandlers} (${Math.round(schemaMappings/totalHandlers*100)}%)`);

    console.log(`\n📋 DETAILED RESULTS:`);
    console.log('─'.repeat(60));

    this.validationResults.forEach(result => {
      const status = result.abiParametersMatch && result.schemaMapping && result.issues.length === 0 
        ? '✅' : '⚠️';
      
      console.log(`\n${status} ${result.handler}:`);
      console.log(`  ABI Parameters: ${result.abiParametersMatch ? '✅' : '❌'}`);
      console.log(`  Expected: [${result.expectedParams.join(', ')}]`);
      console.log(`  Found: [${result.foundParams.join(', ')}]`);
      console.log(`  Schema Mapping: ${result.schemaMapping ? '✅' : '❌'}`);
      
      if (result.issues.length > 0) {
        console.log(`  Issues:`);
        result.issues.forEach(issue => console.log(`    • ${issue}`));
      }
    });

    // ERC-6909 specific analysis
    console.log(`\n🎯 ERC-6909 COMPLIANCE ANALYSIS:`);
    console.log('─'.repeat(40));
    
    const erc6909Events = ['Transfer', 'Approval', 'OperatorSet'];
    erc6909Events.forEach(eventName => {
      const result = this.validationResults.find(r => r.handler === eventName);
      if (result) {
        const compliant = result.abiParametersMatch && result.schemaMapping;
        console.log(`${compliant ? '✅' : '❌'} ${eventName}: ${compliant ? 'Compliant' : 'Issues found'}`);
        if (!compliant && result.issues.length > 0) {
          result.issues.forEach(issue => console.log(`    • ${issue}`));
        }
      }
    });

    console.log(`\n🎉 CONCLUSION:`);
    if (perfectMatches === totalHandlers) {
      console.log('🎊 ALL HANDLERS ARE PERFECTLY ALIGNED WITH ABI AND SCHEMA!');
    } else {
      console.log(`⚠️  ${totalHandlers - perfectMatches} handlers need attention for perfect alignment.`);
    }

    process.exit(perfectMatches === totalHandlers ? 0 : 1);
  }
}

// Run the validation
new HandlerABIValidator().run().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
}); 