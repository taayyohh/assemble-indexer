import type { EventHandler, EventContext, LogData } from '../types';

export class ProtocolFeeUpdatedHandler implements EventHandler {
  eventName = 'ProtocolFeeUpdated';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { oldFee, newFee } = decodedData;

      context.logger.info('Processing ProtocolFeeUpdated', {
        eventName: this.eventName,
        oldFee: oldFee.toString(),
        newFee: newFee.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Track the protocol fee change as a processed event for audit trail
      await context.prisma.processedEvent.create({
        data: {
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          eventName: this.eventName
        }
      });

      context.logger.info('ProtocolFeeUpdated processed successfully', {
        oldFee: oldFee.toString(),
        newFee: newFee.toString(),
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

    } catch (error) {
      context.logger.error('Failed to process ProtocolFeeUpdated', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 