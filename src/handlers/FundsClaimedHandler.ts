import type { EventHandler, EventContext, LogData } from '@/types';

export class FundsClaimedHandler implements EventHandler {
  eventName = 'FundsClaimed';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { recipient, amount } = decodedData;

      context.logger.info('Processing FundsClaimed', {
        eventName: this.eventName,
        recipient,
        amount: amount.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure recipient user exists
      let recipientUser = await context.prisma.user.findUnique({
        where: { address: recipient.toLowerCase() }
      });

      if (!recipientUser) {
        recipientUser = await context.prisma.user.create({
          data: {
            address: recipient.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Log the funds claim for financial tracking
      context.logger.info('FundsClaimed processed successfully', {
        recipientId: recipientUser.id,
        recipientAddress: recipientUser.address,
        amount: amount.toString(),
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

      // This could involve:
      // 1. Creating a FundsClaim model to track all fund withdrawals
      // 2. Linking to specific events if this is event-related fund claiming
      // 3. Tracking treasury/platform fund movements

    } catch (error) {
      context.logger.error('Failed to process FundsClaimed', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 