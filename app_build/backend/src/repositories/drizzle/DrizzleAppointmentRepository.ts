import { eq, and, lte, gte, lt, gt, or, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { appointments, appointmentDevices, services, serviceResources, workingHours, breaks } from '../../db/schema';
import { IAppointmentRepository, CreateAppointmentDTO, ServiceRequirements } from '../interfaces/IAppointmentRepository';

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class DrizzleAppointmentRepository implements IAppointmentRepository {
  
  async getServiceRequirements(tenantId: number, serviceId: number): Promise<ServiceRequirements | null> {
    const serviceRows = await db.select().from(services)
      .where(and(eq(services.tenantId, tenantId), eq(services.id, serviceId)))
      .limit(1);

    if (serviceRows.length === 0) return null;
    const svc = serviceRows[0];

    // Get mapped resources
    const resources = await db.select().from(serviceResources)
      .where(and(eq(serviceResources.tenantId, tenantId), eq(serviceResources.serviceId, serviceId)));

    let requiredRoomId: number | null = null;
    const requiredDeviceIds: number[] = [];

    for (const res of resources) {
      if (res.roomId) requiredRoomId = res.roomId;
      if (res.deviceId) requiredDeviceIds.push(res.deviceId);
    }

    return {
      durationMin: svc.durationMin,
      bufferBeforeMin: svc.bufferBeforeMin || 0,
      bufferAfterMin: svc.bufferAfterMin || 0,
      requiredRoomId,
      requiredDeviceIds
    };
  }

  async createBooking(data: CreateAppointmentDTO): Promise<number> {
    try {
      return await db.transaction(async (tx) => {
        // 1. Validate Working Hours (Timezone Blinded)
        const whCheck = await tx
          .select({ id: workingHours.id })
          .from(workingHours)
          .where(
            and(
              eq(workingHours.tenantId, data.tenantId),
              eq(workingHours.doctorId, data.doctorId),
              eq(workingHours.weekday, data.requestedWeekday),
              lte(workingHours.startLocalTime, data.requestedLocalStartTime),
              gte(workingHours.endLocalTime, data.requestedLocalEndTime)
            )
          )
          .limit(1);

        if (whCheck.length === 0) {
          const err = new Error("The requested time slot is outside the doctor's working hours.");
          err.name = 'ValidationError';
          throw err;
        }

        // 2. Validate Scheduled Breaks
        const breakConditions = [
          and(eq(breaks.resourceType, 'doctor'), eq(breaks.resourceId, data.doctorId)),
          and(eq(breaks.resourceType, 'room'), eq(breaks.resourceId, data.roomId)),
        ];

        if (data.deviceIds.length > 0) {
          breakConditions.push(
            and(eq(breaks.resourceType, 'device'), inArray(breaks.resourceId, data.deviceIds))
          );
        }

        const breakCheck = await tx
          .select({ id: breaks.id })
          .from(breaks)
          .where(
            and(
              eq(breaks.tenantId, data.tenantId),
              lt(breaks.startsAt, data.endsAt),
              gt(breaks.endsAt, data.startsAt),
              or(...breakConditions)
            )
          )
          .limit(1);

        if (breakCheck.length > 0) {
          throw new ConflictError('The requested time slot falls during a scheduled break.');
        }

        // Insert main appointment
        const [appt] = await tx.insert(appointments).values({
          tenantId: data.tenantId,
          doctorId: data.doctorId,
          patientId: data.patientId,
          roomId: data.roomId,
          serviceId: data.serviceId,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
        }).returning({ id: appointments.id });

        // Insert required devices
        if (data.deviceIds.length > 0) {
          const deviceInserts = data.deviceIds.map(deviceId => ({
            appointmentId: appt.id,
            deviceId,
            tenantId: data.tenantId,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
          }));
          await tx.insert(appointmentDevices).values(deviceInserts);
        }

        return appt.id;
      });
    } catch (error: any) {
      // PostgreSQL Exclude constraint violation code is 23P01
      if (error.code === '23P01') {
        throw new ConflictError('The selected time slot overlaps with an existing booking for the requested doctor, room, or device.');
      }
      // PostgreSQL Foreign Key constraint violation code is 23503
      if (error.code === '23503') {
        const err = new Error('One or more selected resources (Doctor, Room, Patient) do not exist or do not belong to this clinic.');
        err.name = 'ValidationError';
        throw err;
      }
      throw error;
    }
  }

  async cancelBooking(tenantId: number, appointmentId: number): Promise<boolean> {
    const result = await db.delete(appointments)
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId)))
      .returning({ id: appointments.id });
    
    return result.length > 0;
  }
}
