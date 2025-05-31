import type { EventHandler, EventContext, LogData } from '@/types';

export class FriendRemovedHandler implements EventHandler {
  eventName = 'FriendRemoved';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { user1, user2 } = decodedData;

      context.logger.info('Processing FriendRemoved', {
        eventName: this.eventName,
        user1,
        user2,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Find both users - they should exist since friendship was established
      const [userRecord1, userRecord2] = await Promise.all([
        context.prisma.user.findUnique({
          where: { address: user1.toLowerCase() }
        }),
        context.prisma.user.findUnique({
          where: { address: user2.toLowerCase() }
        })
      ]);

      if (!userRecord1 || !userRecord2) {
        context.logger.error('One or both users not found for friend removal', {
          user1: user1.toLowerCase(),
          user2: user2.toLowerCase(),
          userRecord1Found: !!userRecord1,
          userRecord2Found: !!userRecord2,
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Remove the friendship record (bidirectional)
      // Note: Friendship is stored as a single record, so we need to find it regardless of direction
      const deletedFriendship = await context.prisma.friend.deleteMany({
        where: {
          OR: [
            {
              userId: userRecord1.id,
              friendId: userRecord2.id
            },
            {
              userId: userRecord2.id,
              friendId: userRecord1.id
            }
          ]
        }
      });

      if (deletedFriendship.count === 0) {
        context.logger.warn('No friendship found to remove', {
          user1Id: userRecord1.id,
          user2Id: userRecord2.id,
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      context.logger.info('FriendRemoved processed successfully', {
        user1Id: userRecord1.id,
        user2Id: userRecord2.id,
        deletedCount: deletedFriendship.count,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process FriendRemoved', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 