import { db } from '../../db';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { NotFoundError } from '../../services/bookingService';
import {
  tenants, services, serviceResources, doctors, rooms,
  workingHours, breaks, appointments, appointmentDevices
} from '../../db/schema';
import { IAvailabilityRepository, AvailabilityResourceData } from '../interfaces/IAvailabilityRepository';

export class DrizzleAvailabilityRepository implements IAvailabilityRepository {
  async getAvailabilityData(
    tenantId: number,
    serviceId: number,
    fromDate: Date,
    toDate: Date,
    doctorIds?: number[]
  ): Promise<AvailabilityResourceData> {

    // 1. Fetch Tenant Info, Service Info & Service Resources concurrently
    const [tenantInfo, serviceInfo, sResources] = await Promise.all([
      db.select().from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1),
      db.select().from(services)
        .where(and(eq(services.id, serviceId), eq(services.tenantId, tenantId)))
        .limit(1),
      db.select().from(serviceResources)
        .where(and(eq(serviceResources.serviceId, serviceId), eq(serviceResources.tenantId, tenantId)))
    ]);

    if (serviceInfo.length === 0) {
      throw new NotFoundError('Service not found');
    }
    const svc = serviceInfo[0];
    const tenantTz = tenantInfo[0]?.timezone || 'Europe/Berlin';
    
    let requiredRoomId: number | null = null;
    const requiredDeviceIds: number[] = [];
    
    for (const r of sResources) {
      if (r.roomId) requiredRoomId = r.roomId;
      if (r.deviceId) requiredDeviceIds.push(r.deviceId);
    }

    // 2. Build dependent queries
    let doctorCondition: any = eq(doctors.tenantId, tenantId);
    if (doctorIds && doctorIds.length > 0) {
      doctorCondition = and(doctorCondition, inArray(doctors.id, doctorIds));
    }

    const validDoctorsPromise = db.select({ id: doctors.id }).from(doctors).where(doctorCondition);

    let allRoomsPromise: Promise<{id: number}[]> = Promise.resolve([]);
    if (!requiredRoomId) {
      allRoomsPromise = db.select({ id: rooms.id }).from(rooms).where(eq(rooms.tenantId, tenantId));
    }

    // Independent bulk queries
    const brksPromise = db.select().from(breaks)
      .where(
        and(
          eq(breaks.tenantId, tenantId),
          lt(breaks.startsAt, toDate),
          gte(breaks.endsAt, fromDate)
        )
      );

    const apptsPromise = db.select().from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          lt(appointments.startsAt, toDate),
          gte(appointments.endsAt, fromDate)
        )
      );

    // Run the second batch of queries concurrently
    const [validDoctors, allRooms, brks, appts] = await Promise.all([
      validDoctorsPromise,
      allRoomsPromise,
      brksPromise,
      apptsPromise
    ]);

    const validDoctorIds = validDoctors.map(d => d.id);
    if (validDoctorIds.length === 0) {
      throw new NotFoundError('No valid doctors found for this search criteria');
    }

    const allRoomIds = requiredRoomId ? [requiredRoomId] : allRooms.map(r => r.id);

    // 3. Third batch (depends on validDoctors & appts)
    const wHoursPromise = db.select().from(workingHours)
      .where(
        and(
          eq(workingHours.tenantId, tenantId),
          inArray(workingHours.doctorId, validDoctorIds)
        )
      );

    let apptDevicesPromise: Promise<any[]> = Promise.resolve([]);
    if (appts.length > 0) {
      const apptIds = appts.map(a => a.id);
      apptDevicesPromise = db.select({
        appointmentId: appointmentDevices.appointmentId,
        deviceId: appointmentDevices.deviceId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        blockedStartsAt: appointments.blockedStartsAt,
        blockedEndsAt: appointments.blockedEndsAt
      })
        .from(appointmentDevices)
        .innerJoin(appointments, eq(appointments.id, appointmentDevices.appointmentId))
        .where(
          and(
            eq(appointmentDevices.tenantId, tenantId),
            inArray(appointmentDevices.appointmentId, apptIds)
          )
        );
    }

    const [wHours, apptDevices] = await Promise.all([
      wHoursPromise,
      apptDevicesPromise
    ]);

    return {
      durationMin: svc.durationMin,
      bufferBeforeMin: svc.bufferBeforeMin || 0,
      bufferAfterMin: svc.bufferAfterMin || 0,
      requiredRoomId,
      requiredDeviceIds,
      timezone: tenantTz,
      validDoctorIds,
      allRoomIds,
      workingHours: wHours.map(w => ({
        doctorId: w.doctorId,
        weekday: w.weekday,
        startTime: w.startLocalTime,
        endTime: w.endLocalTime
      })),
      breaks: brks.map(b => ({
        resourceType: b.resourceType as 'doctor' | 'room' | 'device',
        resourceId: b.resourceId,
        startsAt: b.startsAt,
        endsAt: b.endsAt
      })),
      appointments: appts.map(a => ({
        id: a.id,
        doctorId: a.doctorId,
        roomId: a.roomId,
        startsAt: a.blockedStartsAt || a.startsAt,
        endsAt: a.blockedEndsAt || a.endsAt
      })),
      appointmentDevices: apptDevices.map(ad => ({
        appointmentId: ad.appointmentId,
        deviceId: ad.deviceId,
        startsAt: ad.blockedStartsAt || ad.startsAt,
        endsAt: ad.blockedEndsAt || ad.endsAt
      }))
    };
  }
}
