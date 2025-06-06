import type { EventHandler, EventContext, LogData } from '../types';

export class TokenSupportUpdatedHandler implements EventHandler {
  eventName = 'TokenSupportUpdated';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { token, supported } = decodedData;

      context.logger.info('Processing TokenSupportUpdated', {
        eventName: this.eventName,
        token,
        supported,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Check if token already exists
      const existingToken = await context.prisma.supportedToken.findUnique({
        where: { address: token.toLowerCase() }
      });

      if (existingToken) {
        // Update existing token support status
        const updatedToken = await context.prisma.supportedToken.update({
          where: { address: token.toLowerCase() },
          data: {
            supported,
            chainId: context.chainId,
            blockNumber: context.blockNumber,
            transactionHash: context.transactionHash,
            logIndex: context.logIndex,
            updatedAt: new Date()
          }
        });

        context.logger.info('Updated existing token support status', {
          tokenId: updatedToken.id,
          address: updatedToken.address,
          supported: updatedToken.supported,
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
      } else {
        // Create new supported token record
        const newToken = await context.prisma.supportedToken.create({
          data: {
            address: token.toLowerCase(),
            supported,
            chainId: context.chainId,
            blockNumber: context.blockNumber,
            transactionHash: context.transactionHash,
            logIndex: context.logIndex
          }
        });

        context.logger.info('Created new supported token record', {
          tokenId: newToken.id,
          address: newToken.address,
          supported: newToken.supported,
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });

        // TODO: Optionally fetch token metadata (symbol, name, decimals) from contract
        // This could be done as a background job to avoid slowing down event processing
      }

      context.logger.info('TokenSupportUpdated processed successfully', {
        token: token.toLowerCase(),
        supported,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process TokenSupportUpdated', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 