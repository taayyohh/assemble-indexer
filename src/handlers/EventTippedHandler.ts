import type { EventHandler, EventContext, LogData } from '../types';

export class EventTippedHandler implements EventHandler {
  eventName = 'EventTipped';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, tipper, amount } = decodedData;

      context.logger.info('Processing EventTipped', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        tipper,
        amount: amount.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure tipper user exists
      let tipperUser = await context.prisma.user.findUnique({
        where: { address: tipper.toLowerCase() }
      });

      if (!tipperUser) {
        tipperUser = await context.prisma.user.create({
          data: {
            address: tipper.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Find the event to get the receiver (event organizer)
      const event = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() },
        include: { creator: true }
      });

      if (!event) {
        context.logger.error('Event not found for tip', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Receiver is the event organizer/creator
      const receiverUser = event.creator;

      // Create tip record using EventTip model
      const tip = await context.prisma.eventTip.create({
        data: {
          eventId: event.id,
          tipperId: tipperUser.id,
          receiverId: receiverUser.id,
          amount: amount.toString(),
          message: null, // Message not provided in ABI
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          createdAt: new Date()
        }
      });

      context.logger.info('EventTipped processed successfully', {
        tipId: tip.id,
        eventId: event.id,
        tipperId: tipperUser.id,
        receiverId: receiverUser.id,
        amount: tip.amount,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process EventTipped', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 