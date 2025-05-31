import type { EventHandler, EventContext, LogData } from '@/types';

export class UserInvitedHandler implements EventHandler {
  eventName = 'UserInvited';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, inviter, invitee, message, expiresAt } = decodedData;

      context.logger.info('Processing UserInvited', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        inviter,
        invitee,
        message,
        expiresAt: expiresAt ? expiresAt.toString() : null,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure inviter user exists
      let inviterUser = await context.prisma.user.findUnique({
        where: { address: inviter.toLowerCase() }
      });

      if (!inviterUser) {
        inviterUser = await context.prisma.user.create({
          data: {
            address: inviter.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Ensure invitee user exists
      let inviteeUser = await context.prisma.user.findUnique({
        where: { address: invitee.toLowerCase() }
      });

      if (!inviteeUser) {
        inviteeUser = await context.prisma.user.create({
          data: {
            address: invitee.toLowerCase(),
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
        context.logger.error('Event not found for invitation', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Create invitation record
      const invitation = await context.prisma.invitation.create({
        data: {
          senderId: inviterUser.id,
          receiverId: inviteeUser.id,
          eventId: event.id,
          status: 'PENDING',
          message: message || null,
          expiresAt: expiresAt ? new Date(Number(expiresAt) * 1000) : null,
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      context.logger.info('UserInvited processed successfully', {
        invitationId: invitation.id,
        senderId: inviterUser.id,
        receiverId: inviteeUser.id,
        eventId: event.id,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process UserInvited', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 