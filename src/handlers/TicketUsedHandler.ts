import type { EventHandler, EventContext, LogData } from '@/types';

export class TicketUsedHandler implements EventHandler {
  eventName = 'TicketUsed';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, user, ticketTokenId, tierId } = decodedData;

      context.logger.info('Processing TicketUsed', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        user,
        ticketTokenId: ticketTokenId.toString(),
        tierId: tierId.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure user exists
      let ticketUser = await context.prisma.user.findUnique({
        where: { address: user.toLowerCase() }
      });

      if (!ticketUser) {
        ticketUser = await context.prisma.user.create({
          data: {
            address: user.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Find the ticket by ticketTokenId (ERC-6909 token ID)
      const ticket = await context.prisma.ticket.findUnique({
        where: { ticketId: ticketTokenId.toString() }
      });

      if (!ticket) {
        context.logger.error('Ticket not found for usage', {
          ticketTokenId: ticketTokenId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Find the event
      const event = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (!event) {
        context.logger.error('Event not found for ticket usage', {
          eventId: eventId.toString(),
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
          userId: ticketUser.id,
          ticketId: ticket.id,
          eventId: event.id,
          checkInType: 'MANUAL',
          timestamp: new Date(),
          notes: `Ticket used - Tier: ${tierId.toString()}`,
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          createdAt: new Date()
        }
      });

      context.logger.info('TicketUsed processed successfully', {
        ticketId: updatedTicket.id,
        ticketTokenId: ticketTokenId.toString(),
        tierId: tierId.toString(),
        status: updatedTicket.status,
        checkInId: checkIn.id,
        userId: ticketUser.id,
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