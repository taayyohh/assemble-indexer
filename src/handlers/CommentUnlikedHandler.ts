import type { EventHandler, EventContext, LogData } from '@/types';

export class CommentUnlikedHandler implements EventHandler {
  eventName = 'CommentUnliked';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { commentId, user } = decodedData;

      context.logger.info('Processing CommentUnliked', {
        eventName: this.eventName,
        commentId: commentId.toString(),
        user,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure user exists
      let userRecord = await context.prisma.user.findUnique({
        where: { address: user.toLowerCase() }
      });

      if (!userRecord) {
        userRecord = await context.prisma.user.create({
          data: {
            address: user.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Update comments to track this unlike event (simplified approach)
      const updatedComment = await context.prisma.comment.updateMany({
        where: {
          // TODO: Need on-chain commentId field to properly identify comments
          authorId: userRecord.id
        },
        data: {
          updatedAt: new Date()
        }
      });

      context.logger.info('CommentUnliked processed successfully', {
        commentId: commentId.toString(),
        userId: userRecord.id,
        updatedComments: updatedComment.count,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

      // TODO: Consider removing from CommentLike model for proper unlike tracking

    } catch (error) {
      context.logger.error('Failed to process CommentUnliked', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 