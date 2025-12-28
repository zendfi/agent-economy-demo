/**
 * ZendFi Client Singleton
 * Provides a single instance of the ZendFi SDK client
 */

import { ZendFiClient } from '@zendfi/sdk';

let clientInstance: ZendFiClient | null = null;

export function getZendFiClient(): ZendFiClient {
  if (!clientInstance) {
    const apiKey = process.env.ZENDFI_API_KEY;
    const mode = (process.env.ZENDFI_MODE || 'test') as 'test' | 'live';

    if (!apiKey) {
      throw new Error('ZENDFI_API_KEY is not set in environment variables');
    }

    clientInstance = new ZendFiClient({
      apiKey,
      mode,
      debug: true, // Enable debug logging for development
    });

    console.log(`✓ ZendFi client initialized in ${mode} mode`);
  }

  return clientInstance;
}

export function resetZendFiClient(): void {
  clientInstance = null;
}
