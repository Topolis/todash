/**
 * Status plugin - displays system values using value functions
 * Value functions are registered in server/valueFunctions.ts
 */

export interface StatusItem {
  label: string;
  value: any; // Can be a direct value or an object with value function name as key
  display?: 'text' | 'progress';
  format?: string;
  valueMax?: number;
}

export interface StatusConfig {
  items: StatusItem[];
  refreshSeconds?: number;
}

export interface StatusData {
  items: StatusItem[];
}

/**
 * Status plugin data provider
 * This is handled specially in the API since it needs to evaluate value functions
 */
export async function fetchStatusData(config: StatusConfig): Promise<StatusData> {
  // This function is not actually called directly
  // The /api/widget/status endpoint handles status widget specially
  return { items: config.items };
}
