import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BookingService } from '../services/bookingService';
import { DrizzleAppointmentRepository } from '../repositories/drizzle/DrizzleAppointmentRepository';

const bookingSchema = z.object({
  patientId: z.number(),
  doctorId: z.number(),
  roomId: z.number(),
  serviceId: z.number(),
  startsAt: z.string().datetime({ offset: true }), // Enforce ISO 8601
});

// Manual DI wiring (simplest form)
const repo = new DrizzleAppointmentRepository();
const bookingService = new BookingService(repo);

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId; // Injected by tenantMiddleware
    const data = bookingSchema.parse(req.body);

    const appointmentId = await bookingService.createBooking(
      tenantId,
      data.patientId,
      data.doctorId,
      data.roomId,
      data.serviceId,
      data.startsAt
    );

    req.log.info({ appointmentId }, 'Booking successfully created');
    res.status(201).json({ success: true, appointmentId });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      const e = new Error('Validation failed');
      e.name = 'ValidationError';
      (e as any).details = err.errors;
      return next(e);
    }
    next(err);
  }
};

export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;
    const appointmentId = parseInt(req.params.id, 10);
    
    if (isNaN(appointmentId)) {
      const e = new Error('Invalid appointment ID');
      e.name = 'ValidationError';
      throw e;
    }

    await bookingService.cancelBooking(tenantId, appointmentId);
    req.log.info({ appointmentId }, 'Booking cancelled');
    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') {
        res.status(404).json({ error: err.message });
        return;
    }
    next(err);
  }
};
