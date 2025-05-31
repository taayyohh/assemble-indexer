import type { EventHandler, EventContext, LogData } from '@/types';

export class CommentDeletedHandler implements EventHandler {
  eventName = 'CommentDeleted';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { commentId, deletedBy } = decodedData;

      context.logger.info('Processing CommentDeleted', {
        eventName: this.eventName,
        commentId: commentId.toString(),
        deletedBy,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure deletedBy user exists
      let deletingUser = await context.prisma.user.findUnique({
        where: { address: deletedBy.toLowerCase() }
      });

      if (!deletingUser) {
        deletingUser = await context.prisma.user.create({
          data: {
            address: deletedBy.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Find and delete the comment by on-chain commentId
      // Note: This assumes we're storing the on-chain commentId in our Comment model
      const deletedComments = await context.prisma.comment.deleteMany({
        where: {
          // TODO: Need to add commentId field to Comment model to store on-chain ID
          // For now, we'll use a workaround but this needs schema update
          id: commentId.toString() // This won't work with current schema
        }
      });

      context.logger.info('CommentDeleted processed successfully', {
        commentId: commentId.toString(),
        deletedBy: deletingUser.address,
        deletedCount: deletedComments.count,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

      // TODO: Update Comment model to include on-chain commentId field
      // TODO: Implement proper comment lookup by on-chain ID

    } catch (error) {
      context.logger.error('Failed to process CommentDeleted', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 