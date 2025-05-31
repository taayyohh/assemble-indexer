import type { EventHandler, EventContext, LogData } from '../types';

export class UserInvitedHandler implements EventHandler {
  eventName = 'UserInvited';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, invitee, organizer } = decodedData;

      context.logger.info('Processing UserInvited', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        invitee,
        organizer,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure organizer user exists
      let organizerUser = await context.prisma.user.findUnique({
        where: { address: organizer.toLowerCase() }
      });

      if (!organizerUser) {
        organizerUser = await context.prisma.user.create({
          data: {
            address: organizer.toLowerCase(),
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
          senderId: organizerUser.id,
          receiverId: inviteeUser.id,
          eventId: event.id,
          status: 'PENDING',
          message: null, // Message not provided in ABI
          expiresAt: null, // Expiration not provided in ABI
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
        senderId: organizerUser.id,
        receiverId: inviteeUser.id,
        eventId: event.id,
        status: invitation.status,
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