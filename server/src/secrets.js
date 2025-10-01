import fs from 'fs';
import path from 'path';

// Secrets loader: prefer environment variables; optionally merge from JSON file referenced by SECRETS_FILE
let __SECRETS_CACHE = null;

export function getSecret(name) {
  if (!__SECRETS_CACHE && process.env.SECRETS_FILE) {
    try {
      const p = path.resolve(process.cwd(), process.env.SECRETS_FILE);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        __SECRETS_CACHE = JSON.parse(content);
      }
    } catch (e) {
      console.warn('Failed to load secrets file:', e.message);
      __SECRETS_CACHE = {};
    }
  }
  if (!__SECRETS_CACHE) __SECRETS_CACHE = {};
  return process.env[name] ?? (__SECRETS_CACHE ? __SECRETS_CACHE[name] : undefined);
}
