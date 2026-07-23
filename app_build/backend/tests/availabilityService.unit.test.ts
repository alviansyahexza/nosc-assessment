import { describe, it, expect, beforeEach } from 'vitest';
import { AvailabilityService, calculateFreeIntervals } from '../src/services/availabilityService';
import { IAvailabilityRepository, AvailabilityResourceData } from '../src/repositories/interfaces/IAvailabilityRepository';
import { addMinutes, subMinutes } from 'date-fns';

class MockAvailabilityRepo implements IAvailabilityRepository {
  async getAvailabilityData(tenantId: number, serviceId: number, fromDate: Date, toDate: Date, doctorIds?: number[]): Promise<AvailabilityResourceData> {
    return {
      durationMin: 30,
      bufferBeforeMin: 5,
      bufferAfterMin: 10,
      requiredRoomId: 100,
      requiredDeviceIds: [200],
      timezone: 'Europe/Berlin',
      validDoctorIds: [1],
      allRoomIds: [100],
      workingHours: [
        { doctorId: 1, weekday: fromDate.getDay(), startTime: '09:00:00', endTime: '17:00:00' }
      ],
      breaks: [
        // Break from 12:00 to 13:00 UTC (assuming timezone parsing in test doesn't shift it too much)
        { resourceType: 'doctor', resourceId: 1, startsAt: new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 12, 0, 0), endsAt: new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 13, 0, 0) }
      ],
      appointments: [],
      appointmentDevices: []
    };
  }
}

describe('AvailabilityService (Sweep-Line Unit Tests)', () => {
  let repo: MockAvailabilityRepo;
  let service: AvailabilityService;

  beforeEach(() => {
    repo = new MockAvailabilityRepo();
    service = new AvailabilityService(repo);
  });

  it('finds valid slots based on working hours', async () => {
    const today = new Date();
    // Use an absolute date string to avoid timezone issues in testing
    const fromStr = '2026-10-15T00:00:00.000Z'; // 2026-10-15 is Thursday
    const toStr = '2026-10-16T00:00:00.000Z';

    const result = await service.getAvailability(1, 1, fromStr, toStr);

    expect(result.limit).toBe(3);
    expect(result.slots.length).toBe(3);
    
    // Total block is 45 mins. Start is at 09:00 Berlin time. 09:00 Berlin in Oct (CEST) is 07:00 UTC.
    // Core service start = 07:00 + bufferBefore (5m) = 07:05 UTC.
    expect(result.slots[0].start).toBe('2026-10-15T07:05:00.000Z');
    expect(result.slots[0].end).toBe('2026-10-15T07:35:00.000Z');
    
    // Second slot starts right after total duration (45 mins from 07:00 = 07:45 UTC)
    // Core start = 07:45 + 5m = 07:50 UTC
    expect(result.slots[1].start).toBe('2026-10-15T07:50:00.000Z');
  });

  it('demonstrates sweep-line tie-breaker issue with back-to-back blocks', () => {
    const working = [{ start: new Date('2026-10-15T08:00:00Z'), end: new Date('2026-10-15T17:00:00Z') }];
    const blocked = [
      { start: new Date('2026-10-15T10:00:00Z'), end: new Date('2026-10-15T11:00:00Z') },
      { start: new Date('2026-10-15T11:00:00Z'), end: new Date('2026-10-15T12:00:00Z') },
    ];

    const freeIntervals = calculateFreeIntervals(working, blocked);

    expect(freeIntervals).toEqual([
      { start: new Date('2026-10-15T08:00:00Z'), end: new Date('2026-10-15T10:00:00Z') },
      { start: new Date('2026-10-15T12:00:00Z'), end: new Date('2026-10-15T17:00:00Z') }
    ]);
  });

  it('demonstrates tie-breaker fragmentation issue with contiguous split shifts', () => {
    // Two contiguous working hour shifts: Shift 1 (08:00 - 12:00) and Shift 2 (12:00 - 17:00)
    const working = [
      { start: new Date('2026-10-15T08:00:00Z'), end: new Date('2026-10-15T12:00:00Z') },
      { start: new Date('2026-10-15T12:00:00Z'), end: new Date('2026-10-15T17:00:00Z') },
    ];
    const blocked: any[] = [];

    const freeIntervals = calculateFreeIntervals(working, blocked);

    // Contiguous shifts should result in a single unified free interval [08:00 - 17:00]
    // Current code outputs 2 fragmented intervals because w_end is processed before w_start
    expect(freeIntervals.length).toBe(1);
    expect(freeIntervals[0]).toEqual({
      start: new Date('2026-10-15T08:00:00Z'),
      end: new Date('2026-10-15T17:00:00Z')
    });
  });

  it('handles break ending exactly at shift closing time (b_end vs w_end at 17:00)', () => {
    const working = [{ start: new Date('2026-10-15T08:00:00Z'), end: new Date('2026-10-15T17:00:00Z') }];
    const blocked = [{ start: new Date('2026-10-15T12:00:00Z'), end: new Date('2026-10-15T17:00:00Z') }];

    const freeIntervals = calculateFreeIntervals(working, blocked);

    expect(freeIntervals).toEqual([
      { start: new Date('2026-10-15T08:00:00Z'), end: new Date('2026-10-15T12:00:00Z') }
    ]);
  });

  it('handles break starting exactly at shift opening time (b_start vs w_start at 08:00)', () => {
    const working = [{ start: new Date('2026-10-15T08:00:00Z'), end: new Date('2026-10-15T17:00:00Z') }];
    const blocked = [{ start: new Date('2026-10-15T08:00:00Z'), end: new Date('2026-10-15T10:00:00Z') }];

    const freeIntervals = calculateFreeIntervals(working, blocked);

    expect(freeIntervals).toEqual([
      { start: new Date('2026-10-15T10:00:00Z'), end: new Date('2026-10-15T17:00:00Z') }
    ]);
  });

  it('handles 4-way event collision on exact same timestamp (b_start, w_start, w_end, b_end at 12:00)', () => {
    // Contiguous shifts 08:00-12:00 & 12:00-17:00
    const working = [
      { start: new Date('2026-10-15T08:00:00Z'), end: new Date('2026-10-15T12:00:00Z') },
      { start: new Date('2026-10-15T12:00:00Z'), end: new Date('2026-10-15T17:00:00Z') },
    ];
    // Contiguous breaks 10:00-12:00 & 12:00-13:00
    const blocked = [
      { start: new Date('2026-10-15T10:00:00Z'), end: new Date('2026-10-15T12:00:00Z') },
      { start: new Date('2026-10-15T12:00:00Z'), end: new Date('2026-10-15T13:00:00Z') },
    ];

    const freeIntervals = calculateFreeIntervals(working, blocked);

    expect(freeIntervals).toEqual([
      { start: new Date('2026-10-15T08:00:00Z'), end: new Date('2026-10-15T10:00:00Z') },
      { start: new Date('2026-10-15T13:00:00Z'), end: new Date('2026-10-15T17:00:00Z') }
    ]);
  });
});
