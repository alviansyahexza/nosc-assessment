import { IAppointmentRepository, ServiceRequirements } from '../repositories/interfaces/IAppointmentRepository';

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

export interface BookingTimesResult {
  localDatePart: string;
  localTimePart: string;
  weekday: number;
  endTimeString: string;
  coreStart: Date;
  coreEnd: Date;
  blockedStart: Date;
  blockedEnd: Date;
}

export function computeBookingTimes(
  startsAt: string,
  serviceReqs: Pick<ServiceRequirements, 'durationMin' | 'bufferBeforeMin' | 'bufferAfterMin'>
): BookingTimesResult {
  const requestedStart = new Date(startsAt);
  if (isNaN(requestedStart.getTime())) {
    throw new ValidationError('Invalid startsAt format');
  }

  const [localDatePart, rest] = startsAt.split('T');
  const localTimePart = rest.substring(0, 8);

  const [year, month, day] = localDatePart.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).getDay();

  const totalDurationMin = serviceReqs.durationMin + serviceReqs.bufferBeforeMin + serviceReqs.bufferAfterMin;
  const epochStart = new Date(`1970-01-01T${localTimePart}Z`);
  const endTimeString = new Date(epochStart.getTime() + totalDurationMin * 60_000)
    .toISOString()
    .substring(11, 19);

  const coreStart = requestedStart;
  const coreEnd = new Date(requestedStart.getTime() + serviceReqs.durationMin * 60_000);

  const blockedStart = new Date(requestedStart.getTime() - serviceReqs.bufferBeforeMin * 60_000);
  const blockedEnd = new Date(
    requestedStart.getTime() + (serviceReqs.durationMin + serviceReqs.bufferAfterMin) * 60_000
  );

  return { localDatePart, localTimePart, weekday, endTimeString, coreStart, coreEnd, blockedStart, blockedEnd };
}

export class BookingService {
  constructor(private readonly appointmentRepo: IAppointmentRepository) {}

  async createBooking(
    tenantId: number,
    patientId: number,
    doctorId: number,
    roomId: number,
    serviceId: number,
    startsAt: string
  ) {
    const serviceReqs = await this.appointmentRepo.getServiceRequirements(tenantId, serviceId);

    if (!serviceReqs) {
      throw new NotFoundError('Service not found or not mapped to this tenant');
    }

    const finalRoomId = serviceReqs.requiredRoomId ?? roomId;
    const times = computeBookingTimes(startsAt, serviceReqs);

    return this.appointmentRepo.createBooking({
      tenantId,
      doctorId,
      patientId,
      roomId: finalRoomId,
      serviceId,
      startsAt: times.coreStart,
      endsAt: times.coreEnd,
      blockedStartsAt: times.blockedStart,
      blockedEndsAt: times.blockedEnd,
      deviceIds: serviceReqs.requiredDeviceIds,
      requestedWeekday: times.weekday,
      requestedLocalStartTime: times.localTimePart,
      requestedLocalEndTime: times.endTimeString,
    });
  }

  async cancelBooking(tenantId: number, appointmentId: number) {
    const success = await this.appointmentRepo.cancelBooking(tenantId, appointmentId);
    if (!success) {
      throw new NotFoundError('Appointment not found');
    }
  }
}
