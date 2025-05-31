import type { EventHandler, EventContext, LogData } from '../types';

export class FeeToUpdatedHandler implements EventHandler {
  eventName = 'FeeToUpdated';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { oldFeeTo, newFeeTo } = decodedData;

      context.logger.info('Processing FeeToUpdated', {
        eventName: this.eventName,
        oldFeeTo,
        newFeeTo,
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Create users for old and new fee recipients if they don't exist
      if (oldFeeTo && oldFeeTo !== '0x0000000000000000000000000000000000000000') {
        let oldFeeUser = await context.prisma.user.findUnique({
          where: { address: oldFeeTo.toLowerCase() }
        });

        if (!oldFeeUser) {
          oldFeeUser = await context.prisma.user.create({
            data: {
              address: oldFeeTo.toLowerCase(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }
      }

      if (newFeeTo && newFeeTo !== '0x0000000000000000000000000000000000000000') {
        let newFeeUser = await context.prisma.user.findUnique({
          where: { address: newFeeTo.toLowerCase() }
        });

        if (!newFeeUser) {
          newFeeUser = await context.prisma.user.create({
            data: {
              address: newFeeTo.toLowerCase(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }
      }

      // Track the fee recipient change as a processed event for audit trail
      await context.prisma.processedEvent.create({
        data: {
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: log.logIndex,
          eventName: this.eventName
        }
      });

      context.logger.info('FeeToUpdated processed successfully', {
        oldFeeTo,
        newFeeTo,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        blockNumber: context.blockNumber.toString()
      });

    } catch (error) {
      context.logger.error('Failed to process FeeToUpdated', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 