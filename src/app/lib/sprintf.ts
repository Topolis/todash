/**
 * Simple sprintf implementation for basic formatting
 * Supports %s (string), %d (integer), %f (float)
 */
export function sprintf(format: string, ...args: any[]): string {
  let i = 0;
  return format.replace(/%([sdf])/g, (match, type) => {
    if (i >= args.length) return match;
    const arg = args[i++];
    
    switch (type) {
      case 's':
        return String(arg);
      case 'd':
        return String(Math.floor(Number(arg)));
      case 'f':
        return String(Number(arg));
      default:
        return match;
    }
  });
}
