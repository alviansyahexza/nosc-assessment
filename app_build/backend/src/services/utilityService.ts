import { IUtilityRepository } from '../repositories/interfaces/IUtilityRepository';

export class UtilityService {
  constructor(private readonly utilityRepo: IUtilityRepository) {}

  async getTenantInfo(tenantId: number) {
    return this.utilityRepo.getTenantInfo(tenantId);
  }

  async getServices(tenantId: number) {
    return this.utilityRepo.getServices(tenantId);
  }

  async getDoctors(tenantId: number) {
    return this.utilityRepo.getDoctors(tenantId);
  }

  async getDoctorSchedule(tenantId: number, doctorId: number, from: Date, to: Date) {
    return this.utilityRepo.getDoctorSchedule(tenantId, doctorId, from, to);
  }
}
