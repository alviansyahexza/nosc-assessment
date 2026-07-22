import { IAppointmentRepository } from '../repositories/interfaces/IAppointmentRepository';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BookingService {
  constructor(private readonly appointmentRepo: IAppointmentRepository) { }

  async createBooking(tenantId: number, patientId: number, doctorId: number, roomId: number, serviceId: number, startsAt: string) {
    const serviceReqs = await this.appointmentRepo.getServiceRequirements(tenantId, serviceId);

    if (!serviceReqs) {
      throw new NotFoundError('Service not found or not mapped to this tenant');
    }

    // If the service dictates a specific room, use it. Otherwise, use the user-selected room.
    const finalRoomId = serviceReqs.requiredRoomId !== null ? serviceReqs.requiredRoomId : roomId;

    const requestedStart = new Date(startsAt);
    if (isNaN(requestedStart.getTime())) {
      throw new ValidationError('Invalid startsAt format');
    }

    // 1. Timezone-Blinded Extraction from `startsAt`
    const [datePart, rest] = startsAt.split('T');
    const startTimeString = rest.substring(0, 8); // e.g. "09:30:00"

    // Calculate naive weekday from the literal date string (assuming YYYY-MM-DD)
    const naiveDate = new Date(`${datePart}T00:00:00Z`);
    const weekday = naiveDate.getUTCDay();

    // Calculate total duration
    const totalDurationMin = serviceReqs.durationMin + serviceReqs.bufferBeforeMin + serviceReqs.bufferAfterMin;

    // Calculate naive end time string using a 1970 UTC epoch base to prevent timezone shifts
    const naiveStartEpoch = new Date(`1970-01-01T${startTimeString}Z`);
    const naiveEndEpoch = new Date(naiveStartEpoch.getTime() + totalDurationMin * 60000);
    const endTimeString = naiveEndEpoch.toISOString().substring(11, 19); // e.g. "10:15:00"

    // Calculate total blocked time including buffers (UTC for DB storage)
    const blockedStart = new Date(requestedStart.getTime() - serviceReqs.bufferBeforeMin * 60000);
    const blockedEnd = new Date(requestedStart.getTime() + (serviceReqs.durationMin + serviceReqs.bufferAfterMin) * 60000);

    const appointmentId = await this.appointmentRepo.createBooking({
      tenantId,
      doctorId,
      patientId,
      roomId: finalRoomId,
      serviceId,
      startsAt: blockedStart,
      endsAt: blockedEnd,
      deviceIds: serviceReqs.requiredDeviceIds,
      requestedWeekday: weekday,
      requestedLocalStartTime: startTimeString,
      requestedLocalEndTime: endTimeString
    });

    return appointmentId;
  }

  async cancelBooking(tenantId: number, appointmentId: number) {
    const success = await this.appointmentRepo.cancelBooking(tenantId, appointmentId);
    if (!success) {
      throw new NotFoundError('Appointment not found');
    }
  }
}
