import { db } from '../../db';
import { eq, and, gte, lt } from 'drizzle-orm';
import { services, doctors, appointments } from '../../db/schema';
import { IUtilityRepository, ServiceInfo, DoctorInfo, ScheduleBlock } from '../interfaces/IUtilityRepository';

export class DrizzleUtilityRepository implements IUtilityRepository {
  async getServices(tenantId: number): Promise<ServiceInfo[]> {
    return await db.select({
      id: services.id,
      name: services.name,
      durationMin: services.durationMin,
    }).from(services).where(eq(services.tenantId, tenantId));
  }

  async getDoctors(tenantId: number): Promise<DoctorInfo[]> {
    return await db.select({
      id: doctors.id,
      name: doctors.name,
    }).from(doctors).where(eq(doctors.tenantId, tenantId));
  }

  async getDoctorSchedule(tenantId: number, doctorId: number, from: Date, to: Date): Promise<ScheduleBlock[]> {
    const result = await db.select({
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
    }).from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.doctorId, doctorId),
          lt(appointments.startsAt, to),
          gte(appointments.endsAt, from)
        )
      );

    return result.map(appt => ({
      startsAt: appt.startsAt,
      endsAt: appt.endsAt,
      status: 'Busy'
    }));
  }
}
