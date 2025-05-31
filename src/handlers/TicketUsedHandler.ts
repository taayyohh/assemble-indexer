import type { EventHandler, EventContext, LogData } from '@/types';

export class TicketUsedHandler implements EventHandler {
  eventName = 'TicketUsed';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, ticketId, user, timestamp } = decodedData;

      context.logger.info('Processing TicketUsed', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        ticketId: ticketId.toString(),
        user,
        timestamp: timestamp.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Find the ticket
      const ticket = await context.prisma.ticket.findUnique({
        where: { ticketId: ticketId.toString() }
      });

      if (!ticket) {
        context.logger.error('Ticket not found for usage', {
          ticketId: ticketId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Update ticket status to used
      const updatedTicket = await context.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'USED',
          updatedAt: new Date()
        }
      });

      // Create a check-in record to track when the ticket was used
      const checkIn = await context.prisma.checkIn.create({
        data: {
          userId: ticket.ownerId,
          ticketId: ticket.id,
          eventId: ticket.eventId,
          checkInType: 'MANUAL', // Using correct field name
          timestamp: new Date(Number(timestamp) * 1000),
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          createdAt: new Date()
        }
      });

      context.logger.info('TicketUsed processed successfully', {
        ticketId: updatedTicket.id,
        onChainTicketId: updatedTicket.ticketId,
        status: updatedTicket.status,
        checkInId: checkIn.id,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process TicketUsed', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 