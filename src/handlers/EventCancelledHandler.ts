import type { EventHandler, EventContext, LogData } from '../types';

export class EventCancelledHandler implements EventHandler {
  eventName = 'EventCancelled';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, organizer, timestamp } = decodedData;

      context.logger.info('Processing EventCancelled', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        organizer,
        timestamp: timestamp.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Find the event
      const event = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (!event) {
        context.logger.error('Event not found for cancellation', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Update event status to cancelled
      const updatedEvent = await context.prisma.event.update({
        where: { id: event.id },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });

      context.logger.info('EventCancelled processed successfully', {
        eventId: updatedEvent.id,
        onChainEventId: updatedEvent.eventId,
        status: updatedEvent.status,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process EventCancelled', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 