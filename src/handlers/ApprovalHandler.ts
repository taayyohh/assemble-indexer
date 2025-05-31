import type { EventHandler, EventContext, LogData } from '@/types';

export class ApprovalHandler implements EventHandler {
  eventName = 'Approval';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { owner, spender, id, amount } = decodedData;

      context.logger.info('Processing Approval', {
        eventName: this.eventName,
        owner,
        spender,
        id: id.toString(),
        amount: amount.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure owner user exists
      let ownerUser = await context.prisma.user.findUnique({
        where: { address: owner.toLowerCase() }
      });

      if (!ownerUser) {
        ownerUser = await context.prisma.user.create({
          data: {
            address: owner.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Ensure spender user exists
      let spenderUser = await context.prisma.user.findUnique({
        where: { address: spender.toLowerCase() }
      });

      if (!spenderUser) {
        spenderUser = await context.prisma.user.create({
          data: {
            address: spender.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Log the approval for ERC-6909 compliance tracking
      context.logger.info('Approval processed successfully', {
        ownerId: ownerUser.id,
        ownerAddress: ownerUser.address,
        spenderId: spenderUser.id,
        spenderAddress: spenderUser.address,
        tokenId: id.toString(),
        amount: amount.toString(),
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

      // TODO: Implement approval tracking
      // This could involve:
      // 1. Creating an Approval model to track ERC-6909 approvals
      // 2. Linking approvals to specific tokens/badges
      // 3. Tracking approval amounts and expiration

    } catch (error) {
      context.logger.error('Failed to process Approval', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 