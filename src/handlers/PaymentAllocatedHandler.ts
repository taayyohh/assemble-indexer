import type { EventHandler, EventContext, LogData } from '../types';

export class PaymentAllocatedHandler implements EventHandler {
  eventName = 'PaymentAllocated';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, recipient, amount, role } = decodedData;

      context.logger.info('Processing PaymentAllocated', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        recipient,
        amount: amount.toString(),
        role,
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

      // Find the event
      const event = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (!event) {
        context.logger.error('Event not found for payment allocation', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Log the payment allocation for financial tracking
      context.logger.info('PaymentAllocated processed successfully', {
        eventId: event.id,
        recipientId: recipientUser.id,
        recipientAddress: recipientUser.address,
        amount: amount.toString(),
        role,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });


    } catch (error) {
      context.logger.error('Failed to process PaymentAllocated', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 