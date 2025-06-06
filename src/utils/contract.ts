import { ethers } from 'ethers';
import assembleAbi from '../abi/Assemble.json';
import type { EventContext } from '../types';

export interface PackedEventData {
  basePrice: bigint;
  locationData: bigint;
  startTime: bigint;
  capacity: number;
  venueHash: bigint;
  tierCount: number;
  visibility: number;
  status: number;
  flags: number;
  reserved: number;
  padding: number;
}

export interface UnpackedCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Unpack latitude and longitude from packed coordinate data
 * Format: lat(8 bytes) + lng(8 bytes) = 16 bytes total
 * Coordinates are in 1e-7 degrees precision (11mm accuracy)
 */
export function unpackCoordinates(locationData: bigint): UnpackedCoordinates {
  // Extract latitude (upper 64 bits) and longitude (lower 64 bits)
  const latBits = (locationData >> 64n) & 0xFFFFFFFFFFFFFFFFn;
  const lngBits = locationData & 0xFFFFFFFFFFFFFFFFn;
  
  // Convert from signed integers to floating point degrees
  // Handle two's complement for negative coordinates (64-bit signed integers)
  const maxInt64 = 0x8000000000000000n;
  
  // Convert to signed integers
  let latSigned: number;
  let lngSigned: number;
  
  if (latBits >= maxInt64) {
    // Negative latitude
    latSigned = Number(latBits - (1n << 64n));
  } else {
    // Positive latitude
    latSigned = Number(latBits);
  }
  
  if (lngBits >= maxInt64) {
    // Negative longitude
    lngSigned = Number(lngBits - (1n << 64n));
  } else {
    // Positive longitude
    lngSigned = Number(lngBits);
  }
  
  const latitude = latSigned / 10_000_000;
  const longitude = lngSigned / 10_000_000;

  return { latitude, longitude };
}

/**
 * Get event data from contract storage
 */
export async function getEventDataFromContract(
  eventId: string, 
  context: EventContext
): Promise<PackedEventData> {
  try {
    const provider = new ethers.JsonRpcProvider(getChainConfig(context.chainId).rpcUrl);
    const contract = new ethers.Contract(
      getChainConfig(context.chainId).contractAddress,
      assembleAbi.abi,
      provider
    );

    const eventData = await contract.events(eventId);
    
    return {
      basePrice: eventData.basePrice,
      locationData: eventData.locationData,
      startTime: eventData.startTime,
      capacity: Number(eventData.capacity),
      venueHash: eventData.venueHash,
      tierCount: Number(eventData.tierCount),
      visibility: Number(eventData.visibility),
      status: Number(eventData.status),
      flags: Number(eventData.flags),
      reserved: Number(eventData.reserved),
      padding: Number(eventData.padding)
    };
  } catch (error) {
    context.logger.error('Failed to read event data from contract', {
      eventId,
      chainId: context.chainId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get event metadata (including venue name) from contract
 */
export async function getEventMetadata(
  eventId: string,
  context: EventContext
): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(getChainConfig(context.chainId).rpcUrl);
    const contract = new ethers.Contract(
      getChainConfig(context.chainId).contractAddress,
      assembleAbi.abi,
      provider
    );

    const metadata = await contract.eventMetadata(eventId);
    return metadata;
  } catch (error) {
    context.logger.error('Failed to read event metadata from contract', {
      eventId,
      chainId: context.chainId,
      error: (error as Error).message
    });
    return '';
  }
}

/**
 * Detect payment method from transaction logs
 */
export async function detectPaymentMethod(
  transactionHash: string,
  context: EventContext
): Promise<'ETH' | 'ERC20'> {
  try {
    const provider = new ethers.JsonRpcProvider(getChainConfig(context.chainId).rpcUrl);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    
    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }

    // Look for ERC20 Transfer events in the logs
    const erc20TransferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    const hasERC20Transfer = receipt.logs.some((log: any) => 
      log.topics[0] === erc20TransferSignature
    );

    return hasERC20Transfer ? 'ERC20' : 'ETH';
  } catch (error) {
    context.logger.error('Failed to detect payment method', {
      transactionHash,
      chainId: context.chainId,
      error: (error as Error).message
    });
    // Default to ETH if detection fails
    return 'ETH';
  }
}

/**
 * Get payment token address from transaction (if ERC20)
 */
export async function getPaymentToken(
  transactionHash: string,
  context: EventContext
): Promise<string | null> {
  try {
    const provider = new ethers.JsonRpcProvider(getChainConfig(context.chainId).rpcUrl);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    
    if (!receipt) {
      return null;
    }

    // Look for ERC20 Transfer events and extract token address
    const erc20TransferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    const erc20Transfer = receipt.logs.find((log: any) => 
      log.topics[0] === erc20TransferSignature
    );

    return erc20Transfer ? erc20Transfer.address : null;
  } catch (error) {
    context.logger.error('Failed to get payment token', {
      transactionHash,
      chainId: context.chainId,
      error: (error as Error).message
    });
    return null;
  }
}

/**
 * Get chain configuration by chain ID
 */
function getChainConfig(chainId: number): { rpcUrl: string; contractAddress: string } {
  // Latest deployed Assemble contract addresses (identical across networks using CREATE2)
  const ASSEMBLE_CONTRACT_ADDRESS = '0x000000000a020d45fFc5cfcF7B28B5020ddd6a85';
  
  switch (chainId) {
    case 1: // Ethereum mainnet
      return {
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/your-api-key',
        contractAddress: ASSEMBLE_CONTRACT_ADDRESS
      };
    case 11155111: // Sepolia
      return {
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.alchemyapi.io/v2/your-api-key',
        contractAddress: process.env.ASSEMBLE_CONTRACT_ADDRESS || '0x000000000a020d45fFc5cfcF7B28B5020ddd6a85'
      };
    default:
      throw new Error(`Unsupported chain ID: ${chainId}. Only Ethereum Mainnet (1) and Sepolia (11155111) are supported.`);
  }
} 