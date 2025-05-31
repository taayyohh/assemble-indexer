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

      // TODO: Implement comment like tracking when Comment model includes on-chain commentId
      // This would involve:
      // 1. Adding commentId field to Comment model
      // 2. Creating a CommentLike model to track likes
      // 3. Implementing like/unlike logic with proper constraints

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