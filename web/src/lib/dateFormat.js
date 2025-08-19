import dayjs from 'dayjs';

export function formatDate(value, fmt) {
  if (!value) return '';
  // If value is not ISO, dayjs will try to parse best-effort
  try {
    const d = dayjs(value);
    if (!d.isValid()) return String(value);
    return fmt ? d.format(fmt) : d.format('YYYY-MM-DD HH:mm');
  } catch (e) {
    return String(value);
  }
}

