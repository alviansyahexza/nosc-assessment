import { describe, it, expect, beforeEach } from 'vitest';
import { AvailabilityService } from '../src/services/availabilityService';
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
});
