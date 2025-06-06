import type { EventHandler, EventContext, LogData } from '../types';
import { getEventDataFromContract, getEventMetadata, unpackCoordinates } from '../utils/contract';

export class EventCreatedHandler implements EventHandler {
  eventName = 'EventCreated';

  async handle(log: LogData, decodedData: any, context: EventContext): Promise<void> {
    try {
      const { eventId, organizer, startTime } = decodedData;

      context.logger.info('Processing EventCreated', {
        eventName: this.eventName,
        eventId: eventId.toString(),
        organizer,
        startTime: startTime.toString(),
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
        context.logger.info('Created new user for event organizer', {
          userId: user.id,
          address: user.address
        });
      }

      // Check if event already exists
      const existingEvent = await context.prisma.event.findUnique({
        where: { eventId: eventId.toString() }
      });

      if (existingEvent) {
        context.logger.debug('Event already exists', {
          eventId: eventId.toString(),
          chainId: context.chainId
        });
        return;
      }

      // Extract location data from contract
      let latitude: number | null = null;
      let longitude: number | null = null;
      let venueName: string | null = null;
      let venueHash: string | null = null;
      let locationData: string | null = null;
      let capacity: number | null = null;
      let basePrice: string | null = null;
      let endTime: Date | null = null;

      try {
        // Get packed event data from contract
        const eventData = await getEventDataFromContract(eventId.toString(), context);
        
        // Unpack location coordinates
        if (eventData.locationData && eventData.locationData !== 0n) {
          const coordinates = unpackCoordinates(eventData.locationData);
          latitude = coordinates.latitude;
          longitude = coordinates.longitude;
          locationData = eventData.locationData.toString();
        }

        // Extract other event data
        venueHash = eventData.venueHash ? eventData.venueHash.toString() : null;
        capacity = eventData.capacity || null;
        basePrice = eventData.basePrice ? eventData.basePrice.toString() : null;

        // Get venue name from metadata (this is a simplified approach)
        // In a real implementation, you might want to extract this from event parameters
        // or maintain a separate venue name mapping
        try {
          const metadata = await getEventMetadata(eventId.toString(), context);
          // For now, we'll leave venueName extraction for later implementation
          // as it requires parsing the full event creation transaction
        } catch (metadataError) {
          context.logger.debug('Could not fetch event metadata', {
            eventId: eventId.toString(),
            error: (metadataError as Error).message
          });
        }

        context.logger.debug('Extracted event data from contract', {
          eventId: eventId.toString(),
          latitude,
          longitude,
          venueHash,
          capacity,
          basePrice
        });

      } catch (contractError) {
        context.logger.warn('Failed to extract contract data, proceeding with basic event creation', {
          eventId: eventId.toString(),
          error: (contractError as Error).message
        });
      }

      // Create the event record with enhanced data
      const event = await context.prisma.event.create({
        data: {
          eventId: eventId.toString(),
          title: `Event ${eventId}`, // Basic title, can be updated later
          description: null,
          location: null, // Legacy location field
          startTime: new Date(Number(startTime) * 1000),
          endTime,
          imageUrl: null,
          
          // NEW: Location data
          latitude,
          longitude,
          venueName,
          venueHash,
          locationData,
          
          // NEW: Enhanced metadata
          capacity,
          basePrice,
          
          visibility: 'PUBLIC',
          status: 'PUBLISHED',
          maxAttendees: capacity,
          creatorId: user.id,
          chainId: context.chainId,
          blockNumber: context.blockNumber,
          transactionHash: context.transactionHash,
          logIndex: context.logIndex
        }
      });

      context.logger.info('EventCreated processed successfully', {
        eventId: event.id,
        onChainEventId: event.eventId,
        creatorId: event.creatorId,
        latitude: event.latitude,
        longitude: event.longitude,
        venueHash: event.venueHash,
        capacity: event.capacity,
        chainId: context.chainId,
        transactionHash: context.transactionHash
      });

    } catch (error) {
      context.logger.error('Failed to process EventCreated', {
        error: (error as Error).message,
        chainId: context.chainId,
        transactionHash: context.transactionHash,
        decodedData
      });
      throw error;
    }
  }
} 