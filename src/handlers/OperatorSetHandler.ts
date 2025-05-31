import type { EventHandler, EventContext, LogData } from '@/types';

export class OperatorSetHandler implements EventHandler {
  eventName = 'OperatorSet';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { owner, operator, approved } = decodedData;

      context.logger.info('Processing OperatorSet', {
        eventName: this.eventName,
        owner,
        operator,
        approved,
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

      // Ensure operator user exists
      let operatorUser = await context.prisma.user.findUnique({
        where: { address: operator.toLowerCase() }
      });

      if (!operatorUser) {
        operatorUser = await context.prisma.user.create({
          data: {
            address: operator.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Log the operator approval for ERC-6909 compliance tracking
      context.logger.info('OperatorSet processed successfully', {
        ownerId: ownerUser.id,
        ownerAddress: ownerUser.address,
        operatorId: operatorUser.id,
        operatorAddress: operatorUser.address,
        approved,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

      // TODO: Implement operator tracking
      // This could involve:
      // 1. Creating an Operator model to track ERC-6909 operator approvals
      // 2. Linking operators to specific owners
      // 3. Tracking approval status changes over time

    } catch (error) {
      context.logger.error('Failed to process OperatorSet', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 