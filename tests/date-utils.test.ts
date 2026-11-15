import { describe, expect, test } from 'vitest';
import {
  calculateDaysTogether,
  formatMemoryDateVi,
  formatMemoryLongDateVi,
} from '@/lib/date-utils';

describe('date-utils (Vietnam timezone Asia/Ho_Chi_Minh)', () => {
  test('calculates exact calendar days between start date and current VN date', () => {
    const now = new Date('2026-11-15T16:00:00+07:00');
    expect(calculateDaysTogether('2024-10-12', now)).toBe(764);
  });

  test('uses Asia/Ho_Chi_Minh calendar date around midnight instead of UTC date', () => {
    // 00:30+07:00 on Nov 15 is 17:30Z on Nov 14 in UTC
    const justAfterMidnightVn = new Date('2026-11-15T00:30:00+07:00');
    expect(calculateDaysTogether('2026-11-14', justAfterMidnightVn)).toBe(1);
  });

  test('returns 0 when start date is today or in the future or invalid', () => {
    const now = new Date('2026-11-15T12:00:00+07:00');
    expect(calculateDaysTogether('2026-11-15', now)).toBe(0);
    expect(calculateDaysTogether('2027-01-01', now)).toBe(0);
    expect(calculateDaysTogether('not-a-date', now)).toBe(0);
  });

  test('formats memory dates cleanly for Vietnamese timeline display', () => {
    expect(formatMemoryDateVi('2024-10-12')).toBe('12.10.2024');
    expect(formatMemoryDateVi('2025-02-05')).toBe('05.02.2025');
    expect(formatMemoryLongDateVi('2024-10-12')).toBe('12 Tháng 10, 2024');
  });
});
