import type { EventHandler, EventContext, LogData } from '../types';

export class ERC20FundsClaimedHandler implements EventHandler {
  eventName = 'ERC20FundsClaimed';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { user, token, amount } = decodedData;

      context.logger.info('Processing ERC20FundsClaimed', {
        eventName: this.eventName,
        user,
        token,
        amount: amount.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure the user exists
      let userRecord = await context.prisma.user.findUnique({
        where: { address: user.toLowerCase() }
      });

      if (!userRecord) {
        userRecord = await context.prisma.user.create({
          data: {
            address: user.toLowerCase()
          }
        });
        context.logger.info('Created new user for ERC20 withdrawal', {
          userId: userRecord.id,
          address: userRecord.address
        });
      }

      // Check if withdrawal already exists (prevent duplicates)
      const existingWithdrawal = await context.prisma.eRC20Withdrawal.findFirst({
        where: {
          chainId: context.chainId,
          transactionHash: context.transactionHash,
          logIndex: context.logIndex
        }
      });

      if (existingWithdrawal) {
        context.logger.debug('ERC20 withdrawal already exists', {
          withdrawalId: existingWithdrawal.id,
          chainId: context.chainId,
          transactionHash: context.transactionHash
        });
        return;
      }

      // Create the ERC20 withdrawal record
      const withdrawal = await context.prisma.eRC20Withdrawal.create({
        data: {
          token: token.toLowerCase(),
          amount: amount.toString(),
          userId: userRecord.id,
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: context.logIndex
        }
      });

      context.logger.info('ERC20FundsClaimed processed successfully', {
        withdrawalId: withdrawal.id,
        userId: withdrawal.userId,
        token: withdrawal.token,
        amount: withdrawal.amount,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process ERC20FundsClaimed', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 