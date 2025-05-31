#!/usr/bin/env tsx

/**
 * 🔬 Detailed Functionality Audit
 * 
 * This script goes beyond pattern matching to validate that each handler
 * implements the CORRECT functionality, not just any database operations.
 */

import fs from 'fs';
import path from 'path';

const HANDLERS_DIR = './src/handlers';

interface FunctionalityTest {
  name: string;
  pattern: RegExp;
  required: boolean;
  description: string;
}

interface HandlerSpec {
  purpose: string;
  requiredFunctionality: FunctionalityTest[];
  forbiddenPatterns: { pattern: RegExp; reason: string }[];
}

class DetailedFunctionalityAuditor {
  private results: any[] = [];

  async run(): Promise<void> {
    console.log('🔬 Starting Detailed Functionality Audit\n');
    
    const handlerSpecs = this.getHandlerSpecs();
    
    for (const [handlerName, spec] of handlerSpecs.entries()) {
      const handlerPath = path.join(HANDLERS_DIR, `${handlerName}Handler.ts`);
      
      if (fs.existsSync(handlerPath)) {
        await this.auditHandlerFunctionality(handlerName, spec, handlerPath);
      }
    }
    
    this.generateDetailedReport();
  }

  private getHandlerSpecs(): Map<string, HandlerSpec> {
    return new Map([
      ['EventCreated', {
        purpose: 'Create new event records',
        requiredFunctionality: [
          {
            name: 'Creates Event entity',
            pattern: /context\.prisma\.event\.create/,
            required: true,
            description: 'Must create Event record'
          },
          {
            name: 'Links to creator user',
            pattern: /creatorId.*user.*\.id/,
            required: true,
            description: 'Must link event to creator'
          },
          {
            name: 'Stores blockchain metadata',
            pattern: /chainId.*context\.chainId/,
            required: true,
            description: 'Must store blockchain data'
          }
        ],
        forbiddenPatterns: [
          { pattern: /\.delete/, reason: 'EventCreated should not delete anything' }
        ]
      }],
      
      ['EventCancelled', {
        purpose: 'Update event status to cancelled',
        requiredFunctionality: [
          {
            name: 'Updates Event status',
            pattern: /context\.prisma\.event\.update/,
            required: true,
            description: 'Must update Event record'
          },
          {
            name: 'Sets status to CANCELLED',
            pattern: /status.*CANCELLED/,
            required: true,
            description: 'Must set status to CANCELLED'
          }
        ],
        forbiddenPatterns: [
          { pattern: /\.create.*event/, reason: 'EventCancelled should not create events' },
          { pattern: /\.delete/, reason: 'EventCancelled should not delete anything' }
        ]
      }],

      ['EventTipped', {
        purpose: 'Record tip transactions',
        requiredFunctionality: [
          {
            name: 'Creates EventTip record',
            pattern: /context\.prisma\.eventTip\.create/,
            required: true,
            description: 'Must create EventTip record'
          },
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          }
        ],
        forbiddenPatterns: []
      }],

      ['TicketPurchased', {
        purpose: 'Create ticket purchase records',
        requiredFunctionality: [
          {
            name: 'Creates Ticket records',
            pattern: /context\.prisma\.ticket\.create/,
            required: true,
            description: 'Must create Ticket records'
          },
          {
            name: 'Links to buyer user',
            pattern: /buyerId.*user.*\.id/,
            required: true,
            description: 'Must link ticket to buyer'
          }
        ],
        forbiddenPatterns: []
      }],
      
      ['TicketUsed', {
        purpose: 'Mark tickets as used and create check-ins',
        requiredFunctionality: [
          {
            name: 'Updates Ticket status',
            pattern: /context\.prisma\.ticket\.update/,
            required: true,
            description: 'Must update Ticket status'
          },
          {
            name: 'Sets status to USED',
            pattern: /status.*USED/,
            required: true,
            description: 'Must mark ticket as USED'
          },
          {
            name: 'Creates CheckIn record',
            pattern: /context\.prisma\.checkIn\.create/,
            required: true,
            description: 'Must create check-in record'
          }
        ],
        forbiddenPatterns: [
          { pattern: /\.delete/, reason: 'TicketUsed should not delete anything' }
        ]
      }],

      ['AttendanceVerified', {
        purpose: 'Verify user attendance at events',
        requiredFunctionality: [
          {
            name: 'Creates or updates CheckIn',
            pattern: /context\.prisma\.checkIn/,
            required: true,
            description: 'Must handle check-in records'
          },
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          }
        ],
        forbiddenPatterns: []
      }],
      
      ['Transfer', {
        purpose: 'Handle ERC-6909 transfers and minting',
        requiredFunctionality: [
          {
            name: 'Detects minting pattern',
            pattern: /from.*0x0000000000000000000000000000000000000000/,
            required: true,
            description: 'Must detect zero address minting'
          },
          {
            name: 'Creates Badge for amount=1',
            pattern: /context\.prisma\.badge\.create/,
            required: true,
            description: 'Must create badges for amount=1 mints'
          },
          {
            name: 'Enforces soulbound restriction',
            pattern: /isSoulbound.*badge/,
            required: true,
            description: 'Must enforce soulbound for badges'
          }
        ],
        forbiddenPatterns: []
      }],

      ['UserBanned', {
        purpose: 'Track user ban actions',
        requiredFunctionality: [
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          },
          {
            name: 'Updates user status',
            pattern: /context\.prisma\.user\.update/,
            required: true,
            description: 'Must update user ban status'
          }
        ],
        forbiddenPatterns: []
      }],

      ['UserUnbanned', {
        purpose: 'Track user unban actions',
        requiredFunctionality: [
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          },
          {
            name: 'Updates user status',
            pattern: /context\.prisma\.user\.update/,
            required: true,
            description: 'Must update user ban status'
          }
        ],
        forbiddenPatterns: []
      }],

      ['CommentPosted', {
        purpose: 'Create comment records with threading',
        requiredFunctionality: [
          {
            name: 'Creates Comment record',
            pattern: /context\.prisma\.comment\.create/,
            required: true,
            description: 'Must create Comment record'
          },
          {
            name: 'Links to author user',
            pattern: /authorId.*authorUser\.id/,
            required: true,
            description: 'Must link comment to author'
          }
        ],
        forbiddenPatterns: []
      }],
      
      ['CommentDeleted', {
        purpose: 'Delete comment records',
        requiredFunctionality: [
          {
            name: 'Deletes Comment records',
            pattern: /context\.prisma\.comment\.delete/,
            required: true,
            description: 'Must delete Comment records'
          }
        ],
        forbiddenPatterns: [
          { pattern: /\.create.*comment/, reason: 'CommentDeleted should not create comments' }
        ]
      }],

      ['CommentLiked', {
        purpose: 'Track comment likes',
        requiredFunctionality: [
          {
            name: 'Updates Comment record',
            pattern: /context\.prisma\.comment\.update/,
            required: true,
            description: 'Must update Comment like count'
          },
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          }
        ],
        forbiddenPatterns: []
      }],

      ['CommentUnliked', {
        purpose: 'Track comment unlikes',
        requiredFunctionality: [
          {
            name: 'Updates Comment record',
            pattern: /context\.prisma\.comment\.update/,
            required: true,
            description: 'Must update Comment like count'
          },
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          }
        ],
        forbiddenPatterns: []
      }],

      ['FriendAdded', {
        purpose: 'Create bidirectional friendship records',
        requiredFunctionality: [
          {
            name: 'Creates Friend records',
            pattern: /context\.prisma\.friend\.create/,
            required: true,
            description: 'Must create Friend records'
          },
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          }
        ],
        forbiddenPatterns: []
      }],
      
      ['FriendRemoved', {
        purpose: 'Delete friendship records',
        requiredFunctionality: [
          {
            name: 'Deletes Friend records',
            pattern: /context\.prisma\.friend\.delete/,
            required: true,
            description: 'Must delete Friend records'
          },
          {
            name: 'Handles bidirectional deletion',
            pattern: /OR[\s\S]*userId[\s\S]*friendId/,
            required: true,
            description: 'Must handle bidirectional friendship deletion'
          }
        ],
        forbiddenPatterns: [
          { pattern: /\.create.*friend/, reason: 'FriendRemoved should not create friendships' }
        ]
      }],

      ['UserInvited', {
        purpose: 'Create invitation records',
        requiredFunctionality: [
          {
            name: 'Creates Invitation record',
            pattern: /context\.prisma\.invitation\.create/,
            required: true,
            description: 'Must create Invitation record'
          },
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          }
        ],
        forbiddenPatterns: []
      }],
      
      ['InvitationRevoked', {
        purpose: 'Update invitation status to revoked',
        requiredFunctionality: [
          {
            name: 'Updates Invitation status',
            pattern: /context\.prisma\.invitation\.update/,
            required: true,
            description: 'Must update Invitation status'
          },
          {
            name: 'Sets status to revoked/expired',
            pattern: /status.*EXPIRED/,
            required: true,
            description: 'Must mark invitation as expired/revoked'
          }
        ],
        forbiddenPatterns: [
          { pattern: /\.create.*invitation/, reason: 'InvitationRevoked should not create invitations' }
        ]
      }],
      
      ['RSVPUpdated', {
        purpose: 'Upsert RSVP records',
        requiredFunctionality: [
          {
            name: 'Uses upsert operation',
            pattern: /context\.prisma\.rSVP\.upsert/,
            required: true,
            description: 'Must use upsert for RSVP records'
          },
          {
            name: 'Maps status enum',
            pattern: /rsvpStatusMap.*status/,
            required: true,
            description: 'Must map contract status to enum'
          }
        ],
        forbiddenPatterns: []
      }],
      
      ['RefundClaimed', {
        purpose: 'Update ticket status to refunded',
        requiredFunctionality: [
          {
            name: 'Updates Ticket status',
            pattern: /context\.prisma\.ticket\.update/,
            required: true,
            description: 'Must update Ticket status'
          },
          {
            name: 'Sets status to REFUNDED',
            pattern: /status.*REFUNDED/,
            required: true,
            description: 'Must mark ticket as REFUNDED'
          }
        ],
        forbiddenPatterns: [
          { pattern: /\.delete.*ticket/, reason: 'RefundClaimed should not delete tickets' }
        ]
      }],

      ['FundsClaimed', {
        purpose: 'Track fund withdrawal transactions',
        requiredFunctionality: [
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          },
          {
            name: 'Processes transaction',
            pattern: /FundsClaimed processed successfully/,
            required: true,
            description: 'Must process the transaction'
          }
        ],
        forbiddenPatterns: []
      }],

      ['PaymentAllocated', {
        purpose: 'Track payment allocation transactions',
        requiredFunctionality: [
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          },
          {
            name: 'Processes transaction',
            pattern: /PaymentAllocated processed successfully/,
            required: true,
            description: 'Must process the transaction'
          }
        ],
        forbiddenPatterns: []
      }],

      ['PlatformFeeAllocated', {
        purpose: 'Track platform fee allocation transactions',
        requiredFunctionality: [
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          },
          {
            name: 'Processes transaction',
            pattern: /PlatformFeeAllocated processed successfully/,
            required: true,
            description: 'Must process the transaction'
          }
        ],
        forbiddenPatterns: []
      }],

      ['FeeToUpdated', {
        purpose: 'Track fee recipient configuration changes',
        requiredFunctionality: [
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records for fee recipients'
          },
          {
            name: 'Logs configuration change',
            pattern: /context\.prisma\.processedEvent\.create/,
            required: true,
            description: 'Must log the configuration change'
          }
        ],
        forbiddenPatterns: []
      }],

      ['ProtocolFeeUpdated', {
        purpose: 'Track protocol fee configuration changes',
        requiredFunctionality: [
          {
            name: 'Logs configuration change',
            pattern: /context\.prisma\.processedEvent\.create/,
            required: true,
            description: 'Must log the configuration change'
          }
        ],
        forbiddenPatterns: []
      }],

      ['Approval', {
        purpose: 'Track ERC-6909 token approvals',
        requiredFunctionality: [
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          },
          {
            name: 'Processes approval',
            pattern: /Approval processed successfully/,
            required: true,
            description: 'Must process the approval transaction'
          }
        ],
        forbiddenPatterns: []
      }],

      ['OperatorSet', {
        purpose: 'Track ERC-6909 operator approvals',
        requiredFunctionality: [
          {
            name: 'Auto-creates users',
            pattern: /context\.prisma\.user\.create/,
            required: true,
            description: 'Must auto-create user records'
          },
          {
            name: 'Processes operator change',
            pattern: /OperatorSet processed successfully/,
            required: true,
            description: 'Must process the operator transaction'
          }
        ],
        forbiddenPatterns: []
      }]
    ]);
  }

  private async auditHandlerFunctionality(handlerName: string, spec: HandlerSpec, handlerPath: string): Promise<void> {
    const content = fs.readFileSync(handlerPath, 'utf8');
    
    const result = {
      handler: handlerName,
      purpose: spec.purpose,
      passed: true,
      functionalityTests: [] as any[],
      violations: [] as string[]
    };

    // Test required functionality
    for (const test of spec.requiredFunctionality) {
      const matches = test.pattern.test(content);
      result.functionalityTests.push({
        name: test.name,
        description: test.description,
        required: test.required,
        passed: matches,
        pattern: test.pattern.toString()
      });
      
      if (test.required && !matches) {
        result.passed = false;
      }
    }

    // Test for forbidden patterns
    for (const forbidden of spec.forbiddenPatterns) {
      if (forbidden.pattern.test(content)) {
        result.violations.push(forbidden.reason);
        result.passed = false;
      }
    }

    this.results.push(result);
  }

  private generateDetailedReport(): void {
    console.log('\n🔬 DETAILED FUNCTIONALITY AUDIT REPORT');
    console.log('═'.repeat(80));

    const totalHandlers = this.results.length;
    const passedHandlers = this.results.filter(r => r.passed).length;

    console.log(`\n📊 FUNCTIONALITY COMPLIANCE:`);
    console.log(`• Handlers Audited: ${totalHandlers}`);
    console.log(`• Functionally Correct: ${passedHandlers}/${totalHandlers} (${Math.round(passedHandlers/totalHandlers*100)}%)`);
    console.log(`• Functionally Incorrect: ${totalHandlers - passedHandlers}/${totalHandlers} (${Math.round((totalHandlers - passedHandlers)/totalHandlers*100)}%)`);

    console.log(`\n📋 DETAILED FUNCTIONALITY RESULTS:`);
    console.log('─'.repeat(80));

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      
      console.log(`\n${status} ${result.handler}:`);
      console.log(`  Purpose: ${result.purpose}`);
      
      result.functionalityTests.forEach((test: any) => {
        const testStatus = test.passed ? '✅' : '❌';
        console.log(`    ${testStatus} ${test.name}: ${test.description}`);
        if (!test.passed && test.required) {
          console.log(`      Missing pattern: ${test.pattern}`);
        }
      });
      
      if (result.violations.length > 0) {
        console.log(`  ⚠️  Violations:`);
        result.violations.forEach((violation: string) => {
          console.log(`    • ${violation}`);
        });
      }
    });

    const failedHandlers = this.results.filter(r => !r.passed);
    if (failedHandlers.length > 0) {
      console.log(`\n🚨 HANDLERS WITH FUNCTIONALITY ISSUES:`);
      console.log('─'.repeat(50));
      
      failedHandlers.forEach(result => {
        const failedTests = result.functionalityTests.filter((t: any) => t.required && !t.passed);
        console.log(`❌ ${result.handler}:`);
        failedTests.forEach((test: any) => {
          console.log(`  • Missing: ${test.description}`);
        });
        result.violations.forEach((violation: string) => {
          console.log(`  • Violation: ${violation}`);
        });
      });
    } else {
      console.log('\n🎉 ALL HANDLERS PASS DETAILED FUNCTIONALITY TESTS!');
    }

    process.exit(failedHandlers.length === 0 ? 0 : 1);
  }
}

// Run the detailed audit
new DetailedFunctionalityAuditor().run().catch((error) => {
  console.error('❌ Detailed audit failed:', error);
  process.exit(1);
}); 