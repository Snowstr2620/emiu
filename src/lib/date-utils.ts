const MS_PER_DAY = 86_400_000;
const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseIsoDateParts(dateStr: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function getVietnamCalendarDateParts(date: Date = new Date()): DateParts {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const parsed = parseIsoDateParts(formatted);
  if (parsed) return parsed;

  // Defensive fallback if Intl locale output differs unexpectedly
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return {
    year: vnTime.getUTCFullYear(),
    month: vnTime.getUTCMonth() + 1,
    day: vnTime.getUTCDate(),
  };
}

export function calculateDaysTogether(startDate: string, now: Date = new Date()): number {
  const start = parseIsoDateParts(startDate);
  if (!start) return 0;

  const todayVn = getVietnamCalendarDateParts(now);
  const startUtcMs = Date.UTC(start.year, start.month - 1, start.day);
  const todayUtcMs = Date.UTC(todayVn.year, todayVn.month - 1, todayVn.day);

  const diffDays = Math.floor((todayUtcMs - startUtcMs) / MS_PER_DAY);
  return Math.max(0, diffDays);
}

export function formatMemoryDateVi(dateStr: string): string {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return dateStr;
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  return `${dd}.${mm}.${parts.year}`;
}

export function formatMemoryLongDateVi(dateStr: string): string {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return dateStr;
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  return `${dd} Tháng ${mm}, ${parts.year}`;
}
