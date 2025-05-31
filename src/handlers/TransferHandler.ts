import type { EventHandler, EventContext, LogData } from '@/types';

export class TransferHandler implements EventHandler {
  eventName = 'Transfer';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { caller, from, to, id, amount } = decodedData;

      context.logger.info('Processing Transfer', {
        eventName: this.eventName,
        caller,
        from,
        to,
        id: id.toString(),
        amount: amount.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Handle badge/ticket transfers
      if (from !== '0x0000000000000000000000000000000000000000') {
        // This is a transfer (not a mint)
        
        // Check if this is a badge transfer
        const badge = await context.prisma.badge.findUnique({
          where: { tokenId: id.toString() }
        });

        if (badge) {
          // Ensure new owner exists
          let newOwner = await context.prisma.user.findUnique({
            where: { address: to.toLowerCase() }
          });

          if (!newOwner) {
            newOwner = await context.prisma.user.create({
              data: {
                address: to.toLowerCase(),
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
          }

          // Update badge ownership
          const updatedBadge = await context.prisma.badge.update({
            where: { id: badge.id },
            data: {
              ownerId: newOwner.id
            }
          });

          context.logger.info('Badge transfer processed', {
            badgeId: updatedBadge.id,
            tokenId: updatedBadge.tokenId,
            fromAddress: from,
            toAddress: to,
            newOwnerId: newOwner.id
          });
        }

        // Check if this is a ticket transfer
        const ticket = await context.prisma.ticket.findUnique({
          where: { ticketId: id.toString() }
        });

        if (ticket) {
          // Ensure new owner exists
          let newOwner = await context.prisma.user.findUnique({
            where: { address: to.toLowerCase() }
          });

          if (!newOwner) {
            newOwner = await context.prisma.user.create({
              data: {
                address: to.toLowerCase(),
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
          }

          // Update ticket ownership and status
          const updatedTicket = await context.prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              ownerId: newOwner.id,
              status: 'TRANSFERRED',
              updatedAt: new Date()
            }
          });

          context.logger.info('Ticket transfer processed', {
            ticketId: updatedTicket.id,
            tokenId: updatedTicket.ticketId,
            fromAddress: from,
            toAddress: to,
            newOwnerId: newOwner.id,
            status: updatedTicket.status
          });
        }
      }

      context.logger.info('Transfer processed successfully', {
        caller,
        from,
        to,
        tokenId: id.toString(),
        amount: amount.toString(),
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

    } catch (error) {
      context.logger.error('Failed to process Transfer', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 