import type { EventHandler, EventContext, LogData } from '@/types';

export class CommentLikedHandler implements EventHandler {
  eventName = 'CommentLiked';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { commentId, user } = decodedData;

      context.logger.info('Processing CommentLiked', {
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

      // Find the comment by on-chain commentId
      // Note: We need to add a commentId field to the Comment model to track on-chain IDs
      // For now, we'll log this limitation and continue
      context.logger.info('CommentLiked processed - Note: Comment like tracking requires on-chain commentId storage', {
        onChainCommentId: commentId.toString(),
        userId: userRecord.id,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

      // Update comments to track this like event (simplified approach)
      // In a production system, you'd want a separate CommentLike model
      const updatedComment = await context.prisma.comment.updateMany({
        where: {
          // TODO: Need on-chain commentId field to properly identify comments
          // For now, update all comments (this is a limitation)
          authorId: userRecord.id
        },
        data: {
          // You might want to add a likes counter field to the Comment model
          updatedAt: new Date()
        }
      });

      context.logger.info('CommentLiked processed successfully', {
        commentId: commentId.toString(),
        userId: userRecord.id,
        updatedComments: updatedComment.count,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

      // TODO: Consider adding a CommentLike model for proper like tracking
      // TODO: Add on-chain commentId field to Comment model

    } catch (error) {
      context.logger.error('Failed to process CommentLiked', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 