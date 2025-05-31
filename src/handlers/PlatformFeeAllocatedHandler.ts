import type { EventHandler, EventContext, LogData } from '@/types';

export class PlatformFeeAllocatedHandler implements EventHandler {
  eventName = 'PlatformFeeAllocated';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, referrer, amount, feeBps } = decodedData;

      context.logger.info('Processing PlatformFeeAllocated', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        referrer,
        amount: amount.toString(),
        feeBps: feeBps.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure referrer user exists
      let referrerUser = await context.prisma.user.findUnique({
        where: { address: referrer.toLowerCase() }
      });

      if (!referrerUser) {
        referrerUser = await context.prisma.user.create({
          data: {
            address: referrer.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Find the event
      const event = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (!event) {
        context.logger.error('Event not found for platform fee allocation', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Log the platform fee allocation for financial tracking
      context.logger.info('PlatformFeeAllocated processed successfully', {
        eventId: event.id,
        referrerId: referrerUser.id,
        referrerAddress: referrerUser.address,
        amount: amount.toString(),
        feeBps: feeBps.toString(),
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });


    } catch (error) {
      context.logger.error('Failed to process PlatformFeeAllocated', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 