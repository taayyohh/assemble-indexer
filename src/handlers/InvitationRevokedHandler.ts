import type { EventHandler, EventContext, LogData } from '../types';

export class InvitationRevokedHandler implements EventHandler {
  eventName = 'InvitationRevoked';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, invitee, organizer } = decodedData;

      context.logger.info('Processing InvitationRevoked', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        invitee,
        organizer,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Find the event
      const event = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (!event) {
        context.logger.error('Event not found for invitation revocation', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Find the invitee user
      const inviteeUser = await context.prisma.user.findUnique({
        where: { address: invitee.toLowerCase() }
      });

      if (!inviteeUser) {
        context.logger.error('Invitee not found for invitation revocation', {
          invitee: invitee.toLowerCase(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Find the organizer user
      const organizerUser = await context.prisma.user.findUnique({
        where: { address: organizer.toLowerCase() }
      });

      if (!organizerUser) {
        context.logger.error('Organizer not found for invitation revocation', {
          organizer: organizer.toLowerCase(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Update invitation status to revoked
      const updatedInvitations = await context.prisma.invitation.updateMany({
        where: {
          eventId: event.id,
          receiverId: inviteeUser.id,
          senderId: organizerUser.id,
          status: 'PENDING'
        },
        data: {
          status: 'EXPIRED', // Using EXPIRED to indicate revoked
          updatedAt: new Date()
        }
      });

      if (updatedInvitations.count === 0) {
        context.logger.warn('No pending invitation found to revoke', {
          senderId: organizerUser.id,
          receiverId: inviteeUser.id,
          eventId: event.id,
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      context.logger.info('InvitationRevoked processed successfully', {
        eventId: event.id,
        inviteeId: inviteeUser.id,
        organizerId: organizerUser.id,
        revokedInvitations: updatedInvitations.count,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process InvitationRevoked', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 