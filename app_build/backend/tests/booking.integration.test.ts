import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

describe('Booking API Integration Tests', () => {
  beforeAll(async () => {
    // Clear the appointments tables before running tests to ensure clean state
    await db.execute(sql`TRUNCATE TABLE appointment_devices, appointments CASCADE;`);
  });

  afterAll(async () => {
    // Clean up after tests
    await db.execute(sql`TRUNCATE TABLE appointment_devices, appointments CASCADE;`);
  });

  it('handles concurrent booking requests gracefully (Race Condition Test)', async () => {
    // Clinic 42 is our seed tenant ID (tenant_id = 42)
    const payload = {
      patientId: 556, // Alice Wonderland
      doctorId: 101,  // Dr. Smith
      roomId: 12,     // X-Ray Room 1
      serviceId: 7,   // Advanced Ultrasound
      requestedStartTime: '2026-10-15T10:00:00.000Z'
    };

    // We simulate 2 exact same requests at the exact same millisecond
    const req1 = request(app)
      .post('/api/appointments')
      .set('X-Tenant-Id', '42')
      .send(payload);

    const req2 = request(app)
      .post('/api/appointments')
      .set('X-Tenant-Id', '42')
      .send(payload);

    // Fire them concurrently!
    const [res1, res2] = await Promise.all([req1, req2]);

    // One must succeed, one must fail with 409 Conflict.
    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    
    expect(statuses).toEqual([201, 409]);
    
    const successRes = res1.status === 201 ? res1 : res2;
    const conflictRes = res1.status === 409 ? res1 : res2;

    expect(successRes.body).toHaveProperty('success', true);
    expect(successRes.body).toHaveProperty('appointmentId');
    
    expect(conflictRes.body).toHaveProperty('error');
    expect(conflictRes.body.error).toContain('overlaps');
  });

  it('rejects booking without X-Tenant-Id header', async () => {
    const response = await request(app)
      .post('/api/appointments')
      .send({
        patientId: 556,
        doctorId: 101,
        roomId: 12,
        serviceId: 7,
        requestedStartTime: '2026-10-15T11:00:00.000Z'
      });
      
    expect(response.status).toBe(401);
  });
});
