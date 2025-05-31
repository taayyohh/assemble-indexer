import type { EventHandler, EventContext, LogData } from '@/types';

export class AttendanceVerifiedHandler implements EventHandler {
  eventName = 'AttendanceVerified';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, attendee, ticketId, timestamp, location } = decodedData;

      context.logger.info('Processing AttendanceVerified', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        attendee,
        ticketId: ticketId.toString(),
        timestamp: timestamp.toString(),
        location,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure attendee user exists
      let attendeeUser = await context.prisma.user.findUnique({
        where: { address: attendee.toLowerCase() }
      });

      if (!attendeeUser) {
        attendeeUser = await context.prisma.user.create({
          data: {
            address: attendee.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Find the ticket
      const ticket = await context.prisma.ticket.findUnique({
        where: { ticketId: ticketId.toString() }
      });

      if (!ticket) {
        context.logger.error('Ticket not found for attendance verification', {
          ticketId: ticketId.toString(),
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
        context.logger.error('Event not found for attendance verification', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Create check-in record for attendance verification
      const checkIn = await context.prisma.checkIn.create({
        data: {
          userId: attendeeUser.id,
          ticketId: ticket.id,
          eventId: event.id,
          checkInType: 'LOCATION', // Attendance verification typically uses location
          timestamp: new Date(Number(timestamp) * 1000),
          location: location || null,
          notes: 'Attendance verified on-chain',
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          createdAt: new Date()
        }
      });

      context.logger.info('AttendanceVerified processed successfully', {
        checkInId: checkIn.id,
        attendeeId: attendeeUser.id,
        ticketId: ticket.id,
        eventId: event.id,
        timestamp: checkIn.timestamp,
        location: checkIn.location,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process AttendanceVerified', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 