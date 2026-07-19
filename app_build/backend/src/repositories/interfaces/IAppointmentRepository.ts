export interface CreateAppointmentDTO {
  tenantId: number;
  doctorId: number;
  patientId: number;
  roomId: number;
  serviceId: number;
  startsAt: Date;
  endsAt: Date;
  deviceIds: number[];
}

export interface ServiceRequirements {
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  requiredRoomId: number | null;
  requiredDeviceIds: number[];
}

export interface IAppointmentRepository {
  /**
   * Retrieves the service constraints (duration, buffers) and specifically mapped physical resources.
   */
  getServiceRequirements(tenantId: number, serviceId: number): Promise<ServiceRequirements | null>;

  /**
   * Attempts to book the appointment transactionally.
   * Throws `ConflictError` if the DB excludes the booking due to an overlap.
   */
  createBooking(data: CreateAppointmentDTO): Promise<number>;

  /**
   * Cancels a booking.
   */
  cancelBooking(tenantId: number, appointmentId: number): Promise<boolean>;
}
