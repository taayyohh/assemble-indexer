import type { EventHandler, EventContext, LogData } from '../types';

export class VenueCredentialMintedHandler implements EventHandler {
  eventName = 'VenueCredentialMinted';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { organizer, venueHash } = decodedData;

      context.logger.info('Processing VenueCredentialMinted', {
        eventName: this.eventName,
        organizer,
        venueHash: venueHash.toString(),
        chainId: context.chainId,
        blockNumber: context.blockNumber.toString(),
        transactionHash: context.transactionHash
      });

      // Ensure the organizer user exists
      let user = await context.prisma.user.findUnique({
        where: { address: organizer.toLowerCase() }
      });

      if (!user) {
        user = await context.prisma.user.create({
          data: {
            address: organizer.toLowerCase()
          }
        });
        context.logger.info('Created new user for venue credential holder', {
          userId: user.id,
          address: user.address
        });
      }

      // Find the associated event that triggered this credential minting
      // Look for recent events by this organizer with this venue hash
      const recentEvent = await context.prisma.event.findFirst({
        where: {
          creatorId: user.id,
          venueHash: venueHash.toString(),
          chainId: context.chainId
        },
        orderBy: {
          blockNumber: 'desc'
        }
      });

      if (!recentEvent) {
        context.logger.warn('No associated event found for venue credential', {
          organizer,
          venueHash: venueHash.toString(),
          chainId: context.chainId
        });
        return;
      }

      // Generate token ID for the venue credential (ERC-6909 format)
      const tokenId = `${context.chainId}-VENUE-${venueHash.toString()}-${organizer.toLowerCase()}`;

      // Check if credential already exists
      const existingCredential = await context.prisma.venueCredential.findUnique({
        where: { tokenId }
      });

      if (existingCredential) {
        context.logger.debug('Venue credential already exists', {
          tokenId,
          chainId: context.chainId
        });
        return;
      }

      // Get venue name from the event
      const venueName = recentEvent.venueName;

      // Create the venue credential record
      const credential = await context.prisma.venueCredential.create({
        data: {
          tokenId,
          venueHash: venueHash.toString(),
          venueName,
          ownerId: user.id,
          eventId: recentEvent.id,
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: context.logIndex
        }
      });

      context.logger.info('VenueCredentialMinted processed successfully', {
        credentialId: credential.id,
        tokenId: credential.tokenId,
        ownerId: credential.ownerId,
        venueHash: credential.venueHash,
        venueName: credential.venueName,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process VenueCredentialMinted', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 