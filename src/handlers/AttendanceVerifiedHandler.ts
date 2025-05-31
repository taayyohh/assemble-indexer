import type { EventHandler, EventContext, LogData } from '../types';

export class AttendanceVerifiedHandler implements EventHandler {
  eventName = 'AttendanceVerified';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, user } = decodedData;

      context.logger.info('Processing AttendanceVerified', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        user,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure user exists
      let attendeeUser = await context.prisma.user.findUnique({
        where: { address: user.toLowerCase() }
      });

      if (!attendeeUser) {
        attendeeUser = await context.prisma.user.create({
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
        context.logger.error('Event not found for attendance verification', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Find the user's ticket for this event
      const ticket = await context.prisma.ticket.findFirst({
        where: {
          ownerId: attendeeUser.id,
          eventId: event.id,
          status: 'ACTIVE'
        }
      });

      if (!ticket) {
        context.logger.error('No active ticket found for user at this event', {
          userId: attendeeUser.id,
          eventId: event.id,
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Create check-in record for attendance verification
      const checkIn = await context.prisma.checkIn.create({
        data: {
          userId: attendeeUser.id,
          eventId: event.id,
          ticketId: ticket.id,
          checkInType: 'MANUAL', // Simple attendance verification
          timestamp: new Date(),
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