/**
 * Retry fetch with exponential backoff
 */

interface RetryOptions {
  retries?: number;
  backoffMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Fetch with retry logic
 */
export async function retryingFetch(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const { retries = 3, backoffMs = 1000, onRetry } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Fetch failed');
}

/**
 * Fetch JSON with retry logic
 */
export async function retryingJson<T = any>(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<T> {
  const response = await retryingFetch(url, init, options);
  return await response.json();
}
