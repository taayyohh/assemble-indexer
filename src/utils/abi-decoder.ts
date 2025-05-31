import { decodeEventLog, type Address, type Hex } from 'viem';
import AssembleABI from '../abi/Assemble.json';
import type { LogData } from '@/types';

// Contract address from the deployment
export const ASSEMBLE_CONTRACT_ADDRESS: Address = '0x00000004FE7c1E461A1703AF603F1A5F080Be253';

/**
 * ABI Decoder for Assemble Protocol events using viem
 */
export class AssembleABIDecoder {
  private readonly abi = AssembleABI;

  /**
   * Decode a log entry using the Assemble Protocol ABI
   */
  decodeLog(log: LogData): { eventName: string; args: Record<string, any> } | null {
    try {
      // Only decode logs from the Assemble contract
      if (log.address.toLowerCase() !== ASSEMBLE_CONTRACT_ADDRESS.toLowerCase()) {
        return null;
      }

      const decoded = decodeEventLog({
        abi: this.abi,
        topics: log.topics as [Hex, ...Hex[]],
        data: log.data as Hex
      });

      return {
        eventName: decoded.eventName,
        args: decoded.args as Record<string, any>
      };
    } catch (error) {
      // Log doesn't match any known event signature or is not from our contract
      return null;
    }
  }

  /**
   * Check if a log matches a specific event by checking the first topic (event signature)
   */
  isEventType(log: LogData, eventName: string): boolean {
    // Only check logs from the Assemble contract
    if (log.address.toLowerCase() !== ASSEMBLE_CONTRACT_ADDRESS.toLowerCase()) {
      return false;
    }

    try {
      const decoded = this.decodeLog(log);
      return decoded?.eventName === eventName;
    } catch {
      return false;
    }
  }

  /**
   * Get all supported event names from the ABI
   */
  getSupportedEvents(): string[] {
    return [
      'Approval',
      'AttendanceVerified',
      'CommentDeleted',
      'CommentLiked',
      'CommentPosted',
      'CommentUnliked',
      'EventCancelled',
      'EventCreated',
      'EventTipped',
      'FeeToUpdated',
      'FriendAdded',
      'FriendRemoved',
      'FundsClaimed',
      'InvitationRevoked',
      'OperatorSet',
      'PaymentAllocated',
      'PlatformFeeAllocated',
      'ProtocolFeeUpdated',
      'RSVPUpdated',
      'RefundClaimed',
      'TicketPurchased',
      'TicketUsed',
      'Transfer',
      'UserBanned',
      'UserInvited',
      'UserUnbanned'
    ];
  }
}

// Singleton instance
export const abiDecoder = new AssembleABIDecoder(); 