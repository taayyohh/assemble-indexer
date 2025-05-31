import type { EventHandler, EventContext, LogData } from '@/types';

export class EventTippedHandler implements EventHandler {
  eventName = 'EventTipped';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, tipper, receiver, amount, message } = decodedData;

      context.logger.info('Processing EventTipped', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        tipper,
        receiver,
        amount: amount.toString(),
        message,
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

      // Ensure receiver user exists
      let receiverUser = await context.prisma.user.findUnique({
        where: { address: receiver.toLowerCase() }
      });

      if (!receiverUser) {
        receiverUser = await context.prisma.user.create({
          data: {
            address: receiver.toLowerCase(),
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
        context.logger.error('Event not found for tip', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Create tip record using EventTip model
      const tip = await context.prisma.eventTip.create({
        data: {
          eventId: event.id,
          tipperId: tipperUser.id,
          receiverId: receiverUser.id,
          amount: amount.toString(),
          message: message || null,
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