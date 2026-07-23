export interface Service {
  id: number;
  name: string;
  durationMin: number;
}

export interface Doctor {
  id: number;
  name: string;
}

export interface ScheduleBlock {
  startsAt: string;
  endsAt: string;
  status: string;
}

export interface Slot {
  doctorId: number;
  roomId: number;
  deviceIds: number[];
  start: string;
  end: string;
}

export interface TenantInfo {
  id: number;
  name: string;
  timezone: string;
}
