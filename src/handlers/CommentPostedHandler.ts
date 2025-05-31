import type { EventHandler, EventContext, LogData } from '@/types';

export class CommentPostedHandler implements EventHandler {
  eventName = 'CommentPosted';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, commentId, author, parentId } = decodedData;

      context.logger.info('Processing CommentPosted', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        commentId: commentId.toString(),
        author,
        parentId: parentId ? parentId.toString() : null,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure author user exists
      let authorUser = await context.prisma.user.findUnique({
        where: { address: author.toLowerCase() }
      });

      if (!authorUser) {
        authorUser = await context.prisma.user.create({
          data: {
            address: author.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Find the event
      const event = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (!event) {
        context.logger.error('Event not found for comment', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Find parent comment if this is a reply
      let parentComment = null;
      if (parentId && parentId.toString() !== '0') {
        // TODO: Need to add on-chain commentId field to properly find parent
        parentComment = await context.prisma.comment.findFirst({
          where: {
            eventId: event.id,
            authorId: authorUser.id // Temporary workaround
          }
        });
      }

      // Create comment record (content must be provided off-chain or stored separately)
      const comment = await context.prisma.comment.create({
        data: {
          authorId: authorUser.id,
          eventId: event.id,
          content: `Comment ${commentId.toString()}`, // Placeholder - content not in ABI
          parentId: parentComment?.id || null,
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      context.logger.info('CommentPosted processed successfully', {
        commentId: comment.id,
        onChainCommentId: commentId.toString(),
        authorId: authorUser.id,
        eventId: event.id,
        parentId: comment.parentId,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

      // TODO: Update Comment model to store on-chain commentId for proper parent/child relationships

    } catch (error) {
      context.logger.error('Failed to process CommentPosted', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 