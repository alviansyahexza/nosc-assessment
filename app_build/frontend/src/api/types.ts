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
  doctor_id: number;
  room_id: number;
  device_ids: number[];
  start: string;
  end: string;
}
