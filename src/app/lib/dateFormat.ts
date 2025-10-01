import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/**
 * Format a date string or Date object using a format string
 * @param date Date string or Date object
 * @param format Format string (e.g., "DD.MM.YYYY HH:mm")
 * @returns Formatted date string
 */
export function formatDate(date: string | Date | number, format?: string): string {
  if (!date) return '';
  
  const defaultFormat = 'DD.MM.YYYY HH:mm';
  const fmt = format || defaultFormat;
  
  return dayjs(date).format(fmt);
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelative(date: string | Date | number): string {
  if (!date) return '';
  
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  
  return formatDate(date);
}
