import type { EventHandler, EventContext, LogData } from '@/types';

export class CommentDeletedHandler implements EventHandler {
  eventName = 'CommentDeleted';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, commentId, author, moderator } = decodedData;

      context.logger.info('Processing CommentDeleted', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        commentId: commentId.toString(),
        author,
        moderator,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Find the event
      const event = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (!event) {
        context.logger.error('Event not found for comment deletion', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Find the comment to delete
      // Since we don't store on-chain comment IDs, we'll find by author and event
      // This is a limitation - ideally we'd store the on-chain commentId
      const authorUser = await context.prisma.user.findUnique({
        where: { address: author.toLowerCase() }
      });

      if (!authorUser) {
        context.logger.error('Author not found for comment deletion', {
          author: author.toLowerCase(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Find and delete the comment(s) by this author for this event
      // In a production system, you'd want to store the on-chain commentId
      const deletedComments = await context.prisma.comment.deleteMany({
        where: {
          authorId: authorUser.id,
          eventId: event.id,
          // Additional filtering could be added here if we had more context
        }
      });

      // Log the moderator action if it's different from the author (moderation vs self-deletion)
      const isSelfDeletion = author.toLowerCase() === moderator?.toLowerCase();
      
      context.logger.info('CommentDeleted processed successfully', {
        eventId: event.id,
        authorId: authorUser.id,
        deletedCount: deletedComments.count,
        isSelfDeletion,
        moderator: moderator || 'N/A',
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

      // TODO: In a production system, consider:
      // 1. Storing on-chain comment IDs to enable precise deletion
      // 2. Soft deletion instead of hard deletion for audit trails
      // 3. Tracking moderation actions separately

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