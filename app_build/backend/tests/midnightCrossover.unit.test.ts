import { describe, it, expect } from 'vitest';
import { computeBookingTimes, ValidationError } from '../src/services/bookingService';

const DUMMY_SERVICE = {
  durationMin: 30,
  bufferBeforeMin: 5,
  bufferAfterMin: 10,
};

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

describe('computeBookingTimes — weekday extraction (midnight crossover)', () => {

  it('extracts Monday from "2025-09-15T00:30:00+02:00" despite UTC date being Sunday', () => {
    const result = computeBookingTimes('2025-09-15T00:30:00+02:00', DUMMY_SERVICE, '+02:00');
    console.log(`weekday: ${DAY[result.weekday]} (${result.weekday})`);
    expect(result.weekday).toBe(1); // Monday
    expect(result.localDatePart).toBe('2025-09-15');
    expect(result.localTimePart).toBe('00:30:00');
  });

  it('extracts Sunday from "2025-09-21T00:15:00+03:00" despite UTC date being Saturday', () => {
    const result = computeBookingTimes('2025-09-21T00:15:00+03:00', DUMMY_SERVICE, '+03:00');
    console.log(`weekday: ${DAY[result.weekday]} (${result.weekday})`);
    expect(result.weekday).toBe(0); // Sunday
  });

  it('extracts Monday from "2025-09-15T23:30:00-05:00" despite UTC date being Tuesday', () => {
    const result = computeBookingTimes('2025-09-15T23:30:00-05:00', DUMMY_SERVICE, '-05:00');
    console.log(`weekday: ${DAY[result.weekday]} (${result.weekday})`);
    expect(result.weekday).toBe(1); // Monday
  });

  it('extracts Monday from normal morning appointment "2025-09-15T09:30:00+02:00"', () => {
    const result = computeBookingTimes('2025-09-15T09:30:00+02:00', DUMMY_SERVICE, '+02:00');
    expect(result.weekday).toBe(1); // Monday
  });

});

describe('computeBookingTimes — blocked time (UTC boundaries)', () => {

  it('blockedStart = startsAt − bufferBefore, blockedEnd = startsAt + duration + bufferAfter', () => {
    // startsAt "2025-09-15T09:30:00+02:00" = 07:30 UTC
    // bufferBefore 5m  → blockedStart = 07:25 UTC
    // duration 30m + bufferAfter 10m → blockedEnd = 08:10 UTC
    const result = computeBookingTimes('2025-09-15T09:30:00+02:00', DUMMY_SERVICE);
    expect(result.blockedStart.toISOString()).toBe('2025-09-15T07:25:00.000Z');
    expect(result.blockedEnd.toISOString()).toBe('2025-09-15T08:10:00.000Z');
  });

  it('endTimeString = localTimePart + total duration minutes', () => {
    // 09:30 + (5 + 30 + 10) = 09:30 + 45m = 10:15
    const result = computeBookingTimes('2025-09-15T09:30:00+02:00', DUMMY_SERVICE);
    expect(result.localTimePart).toBe('09:30:00');
    expect(result.endTimeString).toBe('10:15:00');
  });

  it('midnight crossover: UTC blocked window is still accurate', () => {
    // startsAt "2025-09-15T00:30:00+02:00" = 2025-09-14T22:30:00Z
    // blockedStart = 22:30 − 5m = 22:25 UTC (still Sep 14)
    // blockedEnd   = 22:30 + 30 + 10 = 23:10 UTC (still Sep 14)
    const result = computeBookingTimes('2025-09-15T00:30:00+02:00', DUMMY_SERVICE);
    expect(result.blockedStart.toISOString()).toBe('2025-09-14T22:25:00.000Z');
    expect(result.blockedEnd.toISOString()).toBe('2025-09-14T23:10:00.000Z');
  });

});

describe('computeBookingTimes — validation', () => {

  it('throws ValidationError for invalid date string', () => {
    expect(() => computeBookingTimes('not-a-date', DUMMY_SERVICE)).toThrow(ValidationError);
  });

  it('throws ValidationError for empty string', () => {
    expect(() => computeBookingTimes('', DUMMY_SERVICE)).toThrow(ValidationError);
  });

});
