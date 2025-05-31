import type { EventHandler, EventContext, LogData } from '../types';

export class EventCreatedHandler implements EventHandler {
  eventName = 'EventCreated';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, organizer, startTime } = decodedData;

      context.logger.info('Processing EventCreated', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        organizer,
        startTime: startTime.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure the organizer user exists
      let user = await context.prisma.user.findUnique({
        where: { address: organizer.toLowerCase() }
      });

      if (!user) {
        user = await context.prisma.user.create({
          data: {
            address: organizer.toLowerCase()
          }
        });
        context.logger.info('Created new user for event organizer', {
          userId: user.id,
          address: user.address
        });
      }

      // Check if event already exists
      const existingEvent = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (existingEvent) {
        context.logger.debug('Event already exists', {
          eventId: eventId.toString(),
          chainId: context.chainId
        });
        return;
      }

      // Create the event record
      const event = await context.prisma.event.create({
        data: {
          eventId: eventId.toString(),
          title: `Event ${eventId}`, // Basic title, can be updated later
          description: null,
          location: null,
          startTime: new Date(Number(startTime) * 1000),
          endTime: null,
          imageUrl: null,
          visibility: 'PUBLIC',
          status: 'PUBLISHED',
          maxAttendees: null,
          creatorId: user.id,
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: context.logIndex
        }
      });

      context.logger.info('EventCreated processed successfully', {
        eventId: event.id,
        onChainEventId: event.eventId,
        creatorId: event.creatorId,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process EventCreated', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 