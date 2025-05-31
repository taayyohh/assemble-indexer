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

      // Log the ban action
      context.logger.info('UserBanned processed successfully', {
        bannedUserId: bannedUser.id,
        bannedUserAddress: bannedUser.address,
        moderatorId: moderatorUser.id,
        moderatorAddress: moderatorUser.address,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

      // TODO: Implement ban tracking
      // This could involve:
      // 1. Adding a 'banned' field to User model
      // 2. Creating a UserBan model to track ban history
      // 3. Implementing ban enforcement in application logic

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