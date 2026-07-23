import { describe, it, expect } from 'vitest';
import { AvailabilityService } from '../src/services/availabilityService';
import { IAvailabilityRepository, AvailabilityResourceData } from '../src/repositories/interfaces/IAvailabilityRepository';
import { computeBookingTimes } from '../src/services/bookingService';

class MockTenantTimezoneRepo implements IAvailabilityRepository {
  constructor(public tenantTimezone: string = 'America/New_York') {}

  async getAvailabilityData(tenantId: number, serviceId: number, fromDate: Date, toDate: Date): Promise<AvailabilityResourceData> {
    return {
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      requiredRoomId: 100,
      requiredDeviceIds: [],
      timezone: this.tenantTimezone,
      validDoctorIds: [1],
      allRoomIds: [100],
      workingHours: [
        { doctorId: 1, weekday: 4, startTime: '09:00:00', endTime: '17:00:00' } // Thursday
      ],
      breaks: [],
      appointments: [],
      appointmentDevices: []
    };
  }
}

describe('Tenant Timezone Dynamic Resolution Unit Tests', () => {
  it('correctly uses tenant database timezone America/New_York in AvailabilityService', async () => {
    const repo = new MockTenantTimezoneRepo('America/New_York');
    const service = new AvailabilityService(repo);

    // 2026-10-15 is EDT (UTC-4). 09:00 EDT should be 13:00 UTC.
    const result = await service.getAvailability(1, 1, '2026-10-15T00:00:00.000Z', '2026-10-16T00:00:00.000Z');

    const firstSlotStart = result.slots[0].start;
    
    // 09:00:00 EDT in America/New_York corresponds to 13:00:00 UTC
    expect(firstSlotStart).toBe('2026-10-15T13:00:00.000Z');
  });

  it('correctly uses tenant database timezone Asia/Jakarta in AvailabilityService', async () => {
    const repo = new MockTenantTimezoneRepo('Asia/Jakarta');
    const service = new AvailabilityService(repo);

    // 2026-10-15 is WIB (UTC+7). 09:00 WIB should be 02:00 UTC.
    const result = await service.getAvailability(1, 1, '2026-10-15T00:00:00.000Z', '2026-10-16T00:00:00.000Z');

    const firstSlotStart = result.slots[0].start;
    
    // 09:00:00 WIB in Asia/Jakarta corresponds to 02:00:00 UTC
    expect(firstSlotStart).toBe('2026-10-15T02:00:00.000Z');
  });

  it('correctly respects tenant database timezone in computeBookingTimes', () => {
    const serviceReqs = { durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 0 };
    // Booking requested at 2026-10-15T13:00:00Z (which is 09:00 AM EDT in America/New_York)
    const startsAt = '2026-10-15T13:00:00Z';

    const times = computeBookingTimes(startsAt, serviceReqs, 'America/New_York');

    // 13:00:00 UTC in America/New_York (EDT, UTC-4) is 09:00:00 local time
    expect(times.localTimePart).toBe('09:00:00');
  });
});
