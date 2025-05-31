import type { EventHandler, EventContext, LogData } from '@/types';

export class RSVPUpdatedHandler implements EventHandler {
  eventName = 'RSVPUpdated';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, user, status } = decodedData;

      context.logger.info('Processing RSVPUpdated', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        user,
        status,
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
        context.logger.error('Event not found for RSVP', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Map status from contract to enum
      const rsvpStatusMap: Record<number, string> = {
        0: 'GOING',
        1: 'MAYBE', 
        2: 'NOT_GOING',
        3: 'PENDING'
      };

      const rsvpStatus = rsvpStatusMap[status] || 'PENDING';

      // Upsert RSVP record
      const rsvp = await context.prisma.rSVP.upsert({
        where: {
          userId_eventId: {
            userId: userRecord.id,
            eventId: event.id
          }
        },
        update: {
          status: rsvpStatus as any,
          notes: null, // Notes not provided in ABI
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          updatedAt: new Date()
        },
        create: {
          userId: userRecord.id,
          eventId: event.id,
          status: rsvpStatus as any,
          notes: null, // Notes not provided in ABI
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      context.logger.info('RSVPUpdated processed successfully', {
        rsvpId: rsvp.id,
        userId: userRecord.id,
        eventId: event.id,
        status: rsvp.status,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process RSVPUpdated', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 