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

      // Find the comment by on-chain commentId and remove like
      // Note: Same limitation as CommentLiked - requires on-chain commentId storage
      context.logger.info('CommentUnliked processed - Note: Comment unlike tracking requires on-chain commentId storage', {
        onChainCommentId: commentId.toString(),
        userId: userRecord.id,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

      // TODO: Implement comment unlike tracking when Comment model includes on-chain commentId
      // This would involve removing the like record from CommentLike model

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