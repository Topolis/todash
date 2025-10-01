import fs from 'fs';
import path from 'path';

/**
 * Secrets loader: prefer environment variables; optionally merge from JSON file referenced by SECRETS_FILE
 */

let secretsCache: Record<string, any> | null = null;

/**
 * Get secret value by name
 * Checks environment variables first, then secrets file
 */
export function getSecret(name: string): string | undefined {
  // Load secrets file on first access if SECRETS_FILE is set
  if (!secretsCache && process.env.SECRETS_FILE) {
    try {
      const secretsPath = path.resolve(process.cwd(), process.env.SECRETS_FILE);
      if (fs.existsSync(secretsPath)) {
        const content = fs.readFileSync(secretsPath, 'utf8');
        secretsCache = JSON.parse(content);
      }
    } catch (e) {
      console.warn('Failed to load secrets file:', (e as Error).message);
      secretsCache = {};
    }
  }
  
  if (!secretsCache) {
    secretsCache = {};
  }
  
  // Environment variables take precedence
  return process.env[name] ?? secretsCache[name];
}

/**
 * Check if a secret exists
 */
export function hasSecret(name: string): boolean {
  return getSecret(name) !== undefined;
}
