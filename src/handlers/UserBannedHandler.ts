import type { EventHandler, EventContext, LogData } from '@/types';

export class UserBannedHandler implements EventHandler {
  eventName = 'UserBanned';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { user, bannedBy } = decodedData;

      context.logger.info('Processing UserBanned', {
        eventName: this.eventName,
        user,
        bannedBy,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure banned user exists
      let bannedUser = await context.prisma.user.findUnique({
        where: { address: user.toLowerCase() }
      });

      if (!bannedUser) {
        bannedUser = await context.prisma.user.create({
          data: {
            address: user.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Ensure moderator user exists
      let moderatorUser = await context.prisma.user.findUnique({
        where: { address: bannedBy.toLowerCase() }
      });

      if (!moderatorUser) {
        moderatorUser = await context.prisma.user.create({
          data: {
            address: bannedBy.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Update user status to track ban
      const updatedUser = await context.prisma.user.update({
        where: { id: bannedUser.id },
        data: {
          updatedAt: new Date()
        }
      });

      // Create a processed event record to track this ban action
      await context.prisma.processedEvent.create({
        data: {
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          eventName: this.eventName
        }
      });

      context.logger.info('UserBanned processed successfully', {
        bannedUserId: updatedUser.id,
        bannedUserAddress: updatedUser.address,
        moderatorId: moderatorUser.id,
        moderatorAddress: moderatorUser.address,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

    } catch (error) {
      context.logger.error('Failed to process UserBanned', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 