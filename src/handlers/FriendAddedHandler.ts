import type { EventHandler, EventContext, LogData } from '@/types';

export class FriendAddedHandler implements EventHandler {
  eventName = 'FriendAdded';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { user1, user2 } = decodedData;

      context.logger.info('Processing FriendAdded', {
        eventName: this.eventName,
        user1,
        user2,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure both users exist
      const users = await Promise.all([
        this.ensureUserExists(user1.toLowerCase(), context),
        this.ensureUserExists(user2.toLowerCase(), context)
      ]);

      const [userRecord1, userRecord2] = users;

      // Check if friendship already exists
      const existingFriendship = await context.prisma.friend.findUnique({
        where: {
          userId_friendId: {
            userId: userRecord1.id,
            friendId: userRecord2.id
          }
        }
      });

      if (existingFriendship) {
        context.logger.debug('Friendship already exists', {
          user1: user1.toLowerCase(),
          user2: user2.toLowerCase(),
          chainId: context.chainId
        });
        return;
      }

      // Create bidirectional friendship
      await Promise.all([
        context.prisma.friend.create({
          data: {
            userId: userRecord1.id,
            friendId: userRecord2.id,
            chainId: context.chainId,
            blockNumber: context.blockNumber,
            transactionHash: context.transactionHash,
            logIndex: context.logIndex
          }
        }),
        context.prisma.friend.create({
          data: {
            userId: userRecord2.id,
            friendId: userRecord1.id,
            chainId: context.chainId,
            blockNumber: context.blockNumber,
            transactionHash: context.transactionHash,
            logIndex: context.logIndex
          }
        })
      ]);

      context.logger.info('FriendAdded processed successfully', {
        user1Id: userRecord1.id,
        user2Id: userRecord2.id,
        user1Address: user1.toLowerCase(),
        user2Address: user2.toLowerCase(),
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process FriendAdded', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }

  private async ensureUserExists(address: string, context: EventContext) {
    let user = await context.prisma.user.findUnique({
      where: { address }
    });

    if (!user) {
      user = await context.prisma.user.create({
        data: { address }
      });
      context.logger.info('Created new user', {
        userId: user.id,
        address: user.address
      });
    }

    return user;
  }
} 