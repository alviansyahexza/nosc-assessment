export interface AvailabilityResourceData {
  // Global Service Info
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  requiredRoomId: number | null;
  requiredDeviceIds: number[];

  // All valid doctors for this service (if client didn't specify)
  validDoctorIds: number[];
  
  // All valid rooms (if service doesn't dictate one)
  allRoomIds: number[];

  // The actual blocks of time
  workingHours: {
    doctorId: number;
    weekday: number;
    startTime: string; // "HH:mm:ss"
    endTime: string;
  }[];

  breaks: {
    resourceType: 'doctor' | 'room' | 'device';
    resourceId: number;
    startsAt: Date;
    endsAt: Date;
  }[];

  appointments: {
    id: number;
    doctorId: number;
    roomId: number;
    startsAt: Date;
    endsAt: Date;
  }[];

  appointmentDevices: {
    appointmentId: number;
    deviceId: number;
    startsAt: Date; // Joined from appointments for easier timeline mapping
    endsAt: Date;
  }[];
}

export interface IAvailabilityRepository {
  /**
   * Fetches all necessary raw data to calculate availability for a given service and time window.
   */
  getAvailabilityData(
    tenantId: number,
    serviceId: number,
    fromDate: Date,
    toDate: Date,
    doctorIds?: number[]
  ): Promise<AvailabilityResourceData>;
}
