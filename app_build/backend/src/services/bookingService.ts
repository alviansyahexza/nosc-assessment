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

  async createBooking(tenantId: number, patientId: number, doctorId: number, roomId: number, serviceId: number, requestedStartTime: string) {
    const serviceReqs = await this.appointmentRepo.getServiceRequirements(tenantId, serviceId);

    if (!serviceReqs) {
      throw new NotFoundError('Service not found or not mapped to this tenant');
    }

    // If the service dictates a specific room, use it. Otherwise, use the user-selected room.
    const finalRoomId = serviceReqs.requiredRoomId !== null ? serviceReqs.requiredRoomId : roomId;

    const requestedStart = new Date(requestedStartTime);
    if (isNaN(requestedStart.getTime())) {
      throw new ValidationError('Invalid requestedStartTime format');
    }

    // Calculate total blocked time including buffers
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
      deviceIds: serviceReqs.requiredDeviceIds
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
