export interface ServiceInfo {
  id: number;
  name: string;
  durationMin: number;
}

export interface DoctorInfo {
  id: number;
  name: string;
}

export interface ScheduleBlock {
  startsAt: Date;
  endsAt: Date;
  status: 'Busy';
}

export interface TenantInfo {
  id: number;
  name: string;
  timezone: string;
}

export interface PatientInfo {
  id: number;
  name: string;
  email?: string | null;
}

export interface IUtilityRepository {
  getTenantInfo(tenantId: number): Promise<TenantInfo | null>;
  getServices(tenantId: number): Promise<ServiceInfo[]>;
  getDoctors(tenantId: number): Promise<DoctorInfo[]>;
  getPatients(tenantId: number): Promise<PatientInfo[]>;
  getDoctorSchedule(tenantId: number, doctorId: number, from: Date, to: Date): Promise<ScheduleBlock[]>;
}
