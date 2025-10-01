/**
 * Simple sprintf implementation for basic formatting
 * Supports:
 * - %s (string)
 * - %d (integer)
 * - %f (float)
 * - %.Nf (float with N decimal places, e.g., %.1f, %.2f)
 */
export function sprintf(format: string, ...args: any[]): string {
  let i = 0;
  return format.replace(/%(?:\.(\d+))?([sdf])/g, (match, precision, type) => {
    if (i >= args.length) return match;
    const arg = args[i++];

    switch (type) {
      case 's':
        return String(arg);
      case 'd':
        return String(Math.floor(Number(arg)));
      case 'f':
        const num = Number(arg);
        if (precision !== undefined) {
          return num.toFixed(parseInt(precision));
        }
        return String(num);
      default:
        return match;
    }
  });
}
