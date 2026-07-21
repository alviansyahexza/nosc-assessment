import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AvailabilityService } from '../services/availabilityService';
import { DrizzleAvailabilityRepository } from '../repositories/drizzle/DrizzleAvailabilityRepository';

const availabilityQuerySchema = z.object({
  service_id: z.string().transform(Number),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  doctor_ids: z.string().optional().transform(val => val ? val.split(',').map(Number) : undefined),
});

const repo = new DrizzleAvailabilityRepository();
const availabilityService = new AvailabilityService(repo);

export const searchAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Missing X-Tenant-Id header' });
      return;
    }

    const query = availabilityQuerySchema.parse(req.query);

    const result = await availabilityService.getAvailability(
      tenantId,
      query.service_id,
      query.from,
      query.to,
      query.doctor_ids
    );

    // Map camelCase to snake_case for the API contract
    const mappedResult = {
      slots: result.slots.map(s => ({
        doctor_id: s.doctorId,
        room_id: s.roomId,
        device_ids: s.deviceIds,
        start: s.start,
        end: s.end
      })),
      limit: result.limit
    };

    res.status(200).json(mappedResult);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    next(error);
  }
};
