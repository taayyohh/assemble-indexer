import type { EventHandler, EventContext, LogData } from '@/types';

export class BadgeIssuedHandler implements EventHandler {
  eventName = 'BadgeIssued';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, recipient, tokenId, badgeType, name, description, imageUrl, isSoulbound } = decodedData;

      context.logger.info('Processing BadgeIssued', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        recipient,
        tokenId: tokenId.toString(),
        badgeType,
        name,
        description,
        imageUrl,
        isSoulbound,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure recipient user exists
      let recipientUser = await context.prisma.user.findUnique({
        where: { address: recipient.toLowerCase() }
      });

      if (!recipientUser) {
        recipientUser = await context.prisma.user.create({
          data: {
            address: recipient.toLowerCase(),
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
        context.logger.error('Event not found for badge', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Map badge type from contract to enum
      const badgeTypeMap: Record<number, string> = {
        0: 'ATTENDANCE',
        1: 'SPEAKER',
        2: 'ORGANIZER',
        3: 'SPONSOR',
        4: 'VIP',
        5: 'EARLY_BIRD',
        6: 'CUSTOM'
      };

      const mappedBadgeType = badgeTypeMap[badgeType] || 'CUSTOM';

      // Create badge record
      const badge = await context.prisma.badge.create({
        data: {
          tokenId: tokenId.toString(),
          badgeType: mappedBadgeType as any,
          name: name,
          description: description || null,
          imageUrl: imageUrl || null,
          isSoulbound: isSoulbound || true,
          ownerId: recipientUser.id,
          eventId: event.id,
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          createdAt: new Date()
        }
      });

      context.logger.info('BadgeIssued processed successfully', {
        badgeId: badge.id,
        tokenId: badge.tokenId,
        badgeType: badge.badgeType,
        ownerId: recipientUser.id,
        eventId: event.id,
        isSoulbound: badge.isSoulbound,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process BadgeIssued', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 