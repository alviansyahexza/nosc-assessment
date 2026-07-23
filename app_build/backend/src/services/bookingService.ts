import { IAppointmentRepository, ServiceRequirements } from '../repositories/interfaces/IAppointmentRepository';
import { formatInTimeZone } from 'date-fns-tz';

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

const DEFAULT_TIMEZONE = 'Europe/Berlin';

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
  serviceReqs: Pick<ServiceRequirements, 'durationMin' | 'bufferBeforeMin' | 'bufferAfterMin'>,
  timezone: string = DEFAULT_TIMEZONE
): BookingTimesResult {
  const requestedStart = new Date(startsAt);
  if (isNaN(requestedStart.getTime())) {
    throw new ValidationError('Invalid startsAt format');
  }

  const localTimePart = formatInTimeZone(requestedStart, timezone, 'HH:mm:ss');
  const localDatePart = formatInTimeZone(requestedStart, timezone, 'yyyy-MM-dd');

  // ISO day of week (1 = Mon, ..., 7 = Sun) mapped to 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayOfWeekStr = formatInTimeZone(requestedStart, timezone, 'i');
  const rawDay = parseInt(dayOfWeekStr, 10);
  const weekday = rawDay === 7 ? 0 : rawDay;

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
  constructor(private readonly appointmentRepo: IAppointmentRepository) { }

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
