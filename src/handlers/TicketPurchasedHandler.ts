import type { EventHandler, EventContext, LogData } from '../types';
import { detectPaymentMethod, getPaymentToken } from '../utils/contract';

export class TicketPurchasedHandler implements EventHandler {
  eventName = 'TicketPurchased';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, buyer, quantity, price } = decodedData;

      context.logger.info('Processing TicketPurchased', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        buyer,
        quantity: quantity.toString(),
        price: price.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure the buyer user exists
      let user = await context.prisma.user.findUnique({
        where: { address: buyer.toLowerCase() }
      });

      if (!user) {
        user = await context.prisma.user.create({
          data: {
            address: buyer.toLowerCase()
          }
        });
        context.logger.info('Created new user for ticket buyer', {
          userId: user.id,
          address: user.address
        });
      }

      // Find the event
      const event = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (!event) {
        context.logger.error('Event not found for ticket purchase', {
          eventId: eventId.toString(),
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Detect payment method from transaction
      const paymentMethod = await detectPaymentMethod(context.transactionHash, context);
      const paymentToken = paymentMethod === 'ERC20' ? 
        await getPaymentToken(context.transactionHash, context) : null;

      context.logger.debug('Detected payment method', {
        paymentMethod,
        paymentToken,
        transactionHash: context.transactionHash
      });

      // Create ticket records for each purchased ticket
      // Note: This is a simplified version - in reality, you'd need to track individual token IDs
      // and properly map to ticket tiers
      for (let i = 0; i < Number(quantity); i++) {
        const ticketId = `${context.transactionHash}-${context.logIndex}-${i}`;
        
        // Try to find the appropriate tier (simplified logic)
        // In production, you'd want to extract tier information from the transaction
        const firstTier = await context.prisma.ticketTier.findFirst({
          where: { eventId: event.id },
          orderBy: { tierId: 'asc' }
        });

        if (!firstTier) {
          context.logger.warn('No ticket tier found for event', {
            eventId: event.id,
            onChainEventId: eventId.toString()
          });
          continue;
        }

        await context.prisma.ticket.create({
          data: {
            ticketId,
            status: 'ACTIVE',
            purchasePrice: price.toString(),
            
            // NEW: Payment method tracking
            paymentMethod: paymentMethod as 'ETH' | 'ERC20',
            paymentToken: paymentToken?.toLowerCase(),
            
            ownerId: user.id,
            eventId: event.id,
            tierid: firstTier.id,
            chainId: context.chainId,
            blockNumber: context.blockNumber,
            transactionHash: context.transactionHash,
            logIndex: context.logIndex,
            platformFee: '0', // Would calculate from price and extract from transaction
            referrerFee: null
          }
        });

        context.logger.debug('Created ticket record', {
          ticketId,
          paymentMethod,
          paymentToken: paymentToken?.toLowerCase(),
          eventId: event.id
        });
      }

      context.logger.info('TicketPurchased processed successfully', {
        eventId: event.id,
        buyerId: user.id,
        quantity: quantity.toString(),
        totalPrice: price.toString(),
        paymentMethod,
        paymentToken: paymentToken?.toLowerCase(),
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process TicketPurchased', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 