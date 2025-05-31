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

      // Ensure recipient user exists
      let recipientUser = await context.prisma.user.findUnique({
        where: { address: to.toLowerCase() }
      });

      if (!recipientUser) {
        recipientUser = await context.prisma.user.create({
          data: {
            address: to.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      const isZeroAddress = from === '0x0000000000000000000000000000000000000000';

      if (isZeroAddress) {
        // This is a mint operation - could be badge or ticket minting
        
        // Determine if this is a badge mint based on token ID patterns or amount
        // Badges typically have amount = 1 and are soulbound
        const isBadgeMint = amount.toString() === '1';
        
        if (isBadgeMint) {
          // Find associated event for this badge (badges are event-specific)
          // Use a reasonable approach to link badge to event
          const recentEvent = await context.prisma.event.findFirst({
            orderBy: { createdAt: 'desc' },
            where: {
              chainId: context.chainId
            }
          });

          if (recentEvent) {
            // Create new badge
            const badge = await context.prisma.badge.create({
              data: {
                tokenId: id.toString(),
                badgeType: 'ATTENDANCE', // Default type, could be determined by event context
                name: `Badge #${id.toString()}`,
                description: `Badge issued for event ${recentEvent.title}`,
                imageUrl: null,
                isSoulbound: true, // All badges are soulbound by default
                ownerId: recipientUser.id,
                eventId: recentEvent.id,
                chainId: context.chainId,
                blockNumber: context.blockNumber,
                transactionHash: context.transactionHash,
                logIndex: log.logIndex,
                createdAt: new Date()
              }
            });

            context.logger.info('Badge minted successfully', {
              badgeId: badge.id,
              tokenId: badge.tokenId,
              recipient: to,
              eventId: recentEvent.id,
              isSoulbound: badge.isSoulbound,
              chainId: context.chainId,
              transactionHash: context.transactionHash
            });
          }
        } else {
          // This might be a ticket mint
          const recentEvent = await context.prisma.event.findFirst({
            orderBy: { createdAt: 'desc' },
            where: {
              chainId: context.chainId
            },
            include: {
              ticketTiers: true
            }
          });

          if (recentEvent && recentEvent.ticketTiers.length > 0) {
            // Use the first available tier
            const defaultTier = recentEvent.ticketTiers[0];
            
            const ticket = await context.prisma.ticket.create({
              data: {
                ticketId: id.toString(),
                ownerId: recipientUser.id,
                eventId: recentEvent.id,
                tierid: defaultTier.id,
                status: 'ACTIVE',
                purchasePrice: '0', // Minted tickets have 0 price initially
                platformFee: '0',
                chainId: context.chainId,
                blockNumber: context.blockNumber,
                transactionHash: context.transactionHash,
                logIndex: log.logIndex,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });

            context.logger.info('Ticket minted successfully', {
              ticketId: ticket.id,
              tokenId: ticket.ticketId,
              recipient: to,
              tierId: defaultTier.id,
              eventId: recentEvent.id,
              chainId: context.chainId,
              transactionHash: context.transactionHash
            });
          }
        }
      } else {
        // This is a transfer (not a mint)
        
        // Check if this is a badge transfer
        const badge = await context.prisma.badge.findUnique({
          where: { tokenId: id.toString() }
        });

        if (badge) {
          if (badge.isSoulbound) {
            context.logger.warn('Attempted transfer of soulbound badge', {
              badgeId: badge.id,
              tokenId: badge.tokenId,
              fromAddress: from,
              toAddress: to,
              chainId: context.chainId,
              transactionHash: context.transactionHash
            });
            return; // Soulbound badges cannot be transferred
          }

          // Update badge ownership for transferable badges
          const updatedBadge = await context.prisma.badge.update({
            where: { id: badge.id },
            data: {
              ownerId: recipientUser.id
            }
          });

          context.logger.info('Badge transfer processed', {
            badgeId: updatedBadge.id,
            tokenId: updatedBadge.tokenId,
            fromAddress: from,
            toAddress: to,
            newOwnerId: recipientUser.id
          });
        }

        // Check if this is a ticket transfer
        const ticket = await context.prisma.ticket.findUnique({
          where: { ticketId: id.toString() }
        });

        if (ticket) {
          // Update ticket ownership and status
          const updatedTicket = await context.prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              ownerId: recipientUser.id,
              status: 'TRANSFERRED',
              updatedAt: new Date()
            }
          });

          context.logger.info('Ticket transfer processed', {
            ticketId: updatedTicket.id,
            tokenId: updatedTicket.ticketId,
            fromAddress: from,
            toAddress: to,
            newOwnerId: recipientUser.id,
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
        isMint: isZeroAddress,
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