import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UtilityService } from '../services/utilityService';
import { DrizzleUtilityRepository } from '../repositories/drizzle/DrizzleUtilityRepository';

const repo = new DrizzleUtilityRepository();
const utilityService = new UtilityService(repo);

const scheduleQuerySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
}).refine(data => new Date(data.from) < new Date(data.to), {
  message: "End date (to) must be strictly after start date (from)",
  path: ["to"],
});

export const getServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const services = await utilityService.getServices(tenantId);
    res.status(200).json({ services });
  } catch (error) {
    next(error);
  }
};

export const getDoctors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const doctors = await utilityService.getDoctors(tenantId);
    res.status(200).json({ doctors });
  } catch (error) {
    next(error);
  }
};

export const getDoctorSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const doctorId = parseInt(req.params.id, 10);
    
    if (isNaN(doctorId)) {
      return res.status(400).json({ error: 'Invalid doctor ID' });
    }

    const { from, to } = scheduleQuerySchema.parse(req.query);
    
    const schedule = await utilityService.getDoctorSchedule(tenantId, doctorId, new Date(from), new Date(to));
    res.status(200).json({ schedule });
  } catch (error) {
    next(error);
  }
};
