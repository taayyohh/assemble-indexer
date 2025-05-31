import type { EventHandler, EventContext, LogData } from '../types';

export class UserUnbannedHandler implements EventHandler {
  eventName = 'UserUnbanned';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { user, unbannedBy } = decodedData;

      context.logger.info('Processing UserUnbanned', {
        eventName: this.eventName,
        user,
        unbannedBy,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure unbanned user exists
      let unbannedUser = await context.prisma.user.findUnique({
        where: { address: user.toLowerCase() }
      });

      if (!unbannedUser) {
        unbannedUser = await context.prisma.user.create({
          data: {
            address: user.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Ensure moderator user exists
      let moderatorUser = await context.prisma.user.findUnique({
        where: { address: unbannedBy.toLowerCase() }
      });

      if (!moderatorUser) {
        moderatorUser = await context.prisma.user.create({
          data: {
            address: unbannedBy.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Update user to mark as unbanned
      const updatedUser = await context.prisma.user.update({
        where: { id: unbannedUser.id },
        data: {
          updatedAt: new Date()
        }
      });

      // Create a processed event record to track this unban action
      await context.prisma.processedEvent.create({
        data: {
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          eventName: this.eventName
        }
      });

      // Log the unban action
      context.logger.info('UserUnbanned processed successfully', {
        unbannedUserId: updatedUser.id,
        unbannedUserAddress: updatedUser.address,
        moderatorId: moderatorUser.id,
        moderatorAddress: moderatorUser.address,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });


    } catch (error) {
      context.logger.error('Failed to process UserUnbanned', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 