import type { EventHandler, EventContext, LogData } from '@/types';

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

      // Log the unban action
      context.logger.info('UserUnbanned processed successfully', {
        unbannedUserId: unbannedUser.id,
        unbannedUserAddress: unbannedUser.address,
        moderatorId: moderatorUser.id,
        moderatorAddress: moderatorUser.address,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

      // TODO: Implement unban tracking
      // This would complement the UserBanned handler and involve:
      // 1. Updating 'banned' field to false in User model
      // 2. Creating unban record in UserBan model
      // 3. Restoring user access in application logic

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