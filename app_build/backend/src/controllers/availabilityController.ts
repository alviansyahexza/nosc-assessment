import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AvailabilityService } from '../services/availabilityService';
import { DrizzleAvailabilityRepository } from '../repositories/drizzle/DrizzleAvailabilityRepository';

const availabilityQuerySchema = z.object({
  serviceId: z.string().transform(Number),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  doctorIds: z.string().optional().transform(val => val ? val.split(',').map(Number) : undefined),
}).refine(data => new Date(data.from) < new Date(data.to), {
  message: "End date (to) must be strictly after start date (from)",
  path: ["to"],
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
      query.serviceId,
      query.from,
      query.to,
      query.doctorIds
    );

    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};
