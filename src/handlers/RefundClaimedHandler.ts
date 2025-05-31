import type { EventHandler, EventContext, LogData } from '../types';

export class RefundClaimedHandler implements EventHandler {
  eventName = 'RefundClaimed';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, user, amount, refundType } = decodedData;

      context.logger.info('Processing RefundClaimed', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        user,
        amount: amount.toString(),
        refundType,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure user exists
      let userRecord = await context.prisma.user.findUnique({
        where: { address: user.toLowerCase() }
      });

      if (!userRecord) {
        userRecord = await context.prisma.user.create({
          data: {
            address: user.toLowerCase(),
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
        context.logger.error('Event not found for refund', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Update ticket status to REFUNDED if this is a ticket refund
      if (refundType === 'TICKET' || refundType === 'ticket') {
        const updatedTickets = await context.prisma.ticket.updateMany({
          where: {
            eventId: event.id,
            ownerId: userRecord.id,
            status: 'ACTIVE' // Only refund active tickets
          },
          data: {
            status: 'REFUNDED',
            updatedAt: new Date()
          }
        });

        context.logger.info('Tickets updated to REFUNDED status', {
          updatedCount: updatedTickets.count,
          userId: userRecord.id,
          eventId: event.id
        });
      }

      // Log the refund transaction for financial tracking
      context.logger.info('RefundClaimed processed successfully', {
        userId: userRecord.id,
        eventId: event.id,
        amount: amount.toString(),
        refundType,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

      // This would provide better financial audit trails

    } catch (error) {
      context.logger.error('Failed to process RefundClaimed', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 