import type { EventHandler, EventContext, LogData } from '../types';

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

      // Ensure user1 exists
      let user1Record = await context.prisma.user.findUnique({
        where: { address: user1.toLowerCase() }
      });

      if (!user1Record) {
        user1Record = await context.prisma.user.create({
          data: {
            address: user1.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Ensure user2 exists
      let user2Record = await context.prisma.user.findUnique({
        where: { address: user2.toLowerCase() }
      });

      if (!user2Record) {
        user2Record = await context.prisma.user.create({
          data: {
            address: user2.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Check if friendship already exists
      const existingFriendship = await context.prisma.friend.findUnique({
        where: {
          userId_friendId: {
            userId: user1Record.id,
            friendId: user2Record.id
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
            userId: user1Record.id,
            friendId: user2Record.id,
            chainId: context.chainId,
            blockNumber: context.blockNumber,
            transactionHash: context.transactionHash,
            logIndex: context.logIndex
          }
        }),
        context.prisma.friend.create({
          data: {
            userId: user2Record.id,
            friendId: user1Record.id,
            chainId: context.chainId,
            blockNumber: context.blockNumber,
            transactionHash: context.transactionHash,
            logIndex: context.logIndex
          }
        })
      ]);

      context.logger.info('FriendAdded processed successfully', {
        user1Id: user1Record.id,
        user2Id: user2Record.id,
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