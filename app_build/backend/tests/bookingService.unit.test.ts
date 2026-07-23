import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService, NotFoundError, ValidationError, computeBookingTimes } from '../src/services/bookingService';
import { IAppointmentRepository, CreateAppointmentDTO, ServiceRequirements } from '../src/repositories/interfaces/IAppointmentRepository';

// Create a stub error to simulate the repo's ConflictError without depending on the exact class
class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

class MockAppointmentRepository implements IAppointmentRepository {
  async getServiceRequirements(tenantId: number, serviceId: number): Promise<ServiceRequirements | null> {
    if (serviceId === 1) {
      return {
        durationMin: 30,
        bufferBeforeMin: 5,
        bufferAfterMin: 10,
        requiredRoomId: 100,
        requiredDeviceIds: [200],
        timezone: 'Europe/Berlin'
      };
    }
    if (serviceId === 2) {
      return {
        durationMin: 15,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        requiredRoomId: null, // Simulate no room mapped
        requiredDeviceIds: [],
        timezone: 'Europe/Berlin'
      };
    }
    return null;
  }
  
  async createBooking(data: CreateAppointmentDTO): Promise<number> {
    if (data.blockedStartsAt && data.blockedStartsAt.toISOString() === '2026-10-10T10:00:00.000Z') {
      throw new ConflictError('Double booking');
    }
    return 1;
  }
  
  async cancelBooking(tenantId: number, appointmentId: number): Promise<boolean> {
    return true;
  }
}

describe('BookingService', () => {
  let repo: MockAppointmentRepository;
  let service: BookingService;

  beforeEach(() => {
    repo = new MockAppointmentRepository();
    service = new BookingService(repo);
  });

  it('preserves core consultation time and calculates blocked buffer window', async () => {
    // Service 1: 30m duration, 5m before, 10m after.
    // Requested Consultation: 10:00 UTC to 10:30 UTC
    // Expected Blocked Window: 09:55 UTC to 10:40 UTC
    
    const createSpy = vi.spyOn(repo, 'createBooking');
    
    await service.createBooking(1, 1, 1, 99, 1, '2026-12-12T10:00:00.000Z');
    
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      startsAt: new Date('2026-12-12T10:00:00.000Z'),
      endsAt: new Date('2026-12-12T10:30:00.000Z'),
      blockedStartsAt: new Date('2026-12-12T09:55:00.000Z'),
      blockedEndsAt: new Date('2026-12-12T10:40:00.000Z'),
      roomId: 100,
      deviceIds: [200]
    }));
  });

  it('throws NotFoundError if service does not exist', async () => {
    await expect(service.createBooking(1, 1, 1, 99, 999, '2026-12-12T10:00:00.000Z'))
      .rejects.toThrow(NotFoundError);
  });
  
  it('bubbles up ConflictError from repository', async () => {
    // The requested time 10:05 minus 5m buffer = 10:00 blockedStart
    // Our mock specifically throws ConflictError for blockedStart = 10:00
    await expect(service.createBooking(1, 1, 1, 99, 1, '2026-10-10T10:05:00.000Z'))
      .rejects.toThrow(ConflictError);
  });

  describe('computeBookingTimes Timezone Awareness', () => {
    it('correctly converts UTC ISO string (06:05:00Z) to Europe/Berlin local time (08:05:00)', () => {
      const serviceReqs = { durationMin: 30, bufferBeforeMin: 5, bufferAfterMin: 10 };
      const res = computeBookingTimes('2026-07-23T06:05:00.000Z', serviceReqs, 'Europe/Berlin');

      expect(res.localTimePart).toBe('08:05:00');
      expect(res.localDatePart).toBe('2026-07-23');
      expect(res.weekday).toBe(4); // Thursday
    });
  });
});
