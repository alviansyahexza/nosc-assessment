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
      startsAt: '2026-10-15T10:00:00.000Z'
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
        startsAt: '2026-10-15T11:00:00.000Z'
      });
      
    expect(response.status).toBe(401);
  });

  describe('Zod Schema Validation (HTTP 400)', () => {
    it('rejects empty payload', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .set('X-Tenant-Id', '42')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('rejects payload with missing required fields', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .set('X-Tenant-Id', '42')
        .send({
          // Missing doctorId and patientId
          roomId: 12,
          serviceId: 7,
          startsAt: '2026-10-15T11:00:00.000Z'
        });
      
      expect(response.status).toBe(400);
    });

    it('rejects payload with invalid date format', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .set('X-Tenant-Id', '42')
        .send({
          patientId: 556,
          doctorId: 101,
          roomId: 12,
          serviceId: 7,
          startsAt: 'invalid-date-string'
        });
      
      expect(response.status).toBe(400);
    });
  });

  describe('Boundary Edge-Cases (Closed-Open Intervals)', () => {
    it('allows booking immediately after another booking ends', async () => {
      const payload1 = {
        patientId: 556,
        doctorId: 101,
        roomId: 12,
        serviceId: 7, // Advanced Ultrasound (duration: 30, bufferBefore: 5, bufferAfter: 10) -> total 45 mins. Blocked: 09:55 to 10:40
        startsAt: '2026-10-16T10:00:00.000Z'
      };

      const payload2 = {
        patientId: 556,
        doctorId: 101,
        roomId: 12,
        serviceId: 7,
        // For payload2, Blocked Start must be >= 10:40. Since bufferBefore is 5, startsAt must be 10:45.
        // Blocked will be 10:40 to 11:25.
        startsAt: '2026-10-16T10:45:00.000Z' 
      };

      const res1 = await request(app)
        .post('/api/appointments')
        .set('X-Tenant-Id', '42')
        .send(payload1);
      
      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post('/api/appointments')
        .set('X-Tenant-Id', '42')
        .send(payload2);
      
      expect(res2.status).toBe(201); // Should not conflict because [11:55, 12:40) and [12:40, 13:25) do not overlap
    });
  });

  describe('Multi-Tenant Data Isolation (Security/Boundary Check)', () => {
    beforeAll(async () => {
      // Setup a valid service for Tenant 99 so the service check passes, exposing the doctor check flaw
      await db.execute(sql`INSERT INTO tenants (id, name) VALUES (99, 'Malicious Clinic') ON CONFLICT DO NOTHING;`);
      await db.execute(sql`INSERT INTO services (id, tenant_id, name, duration_min) VALUES (999, 99, 'Fake Service', 30) ON CONFLICT DO NOTHING;`);
      await db.execute(sql`INSERT INTO patients (id, tenant_id, name) VALUES (999, 99, 'Fake Patient') ON CONFLICT DO NOTHING;`);
    });

    it('rejects cross-tenant booking for resources that do not belong to the tenant', async () => {
      // Doctor 101 and Room 12 belongs to Tenant 42.
      // Tenant 99 should NOT be able to book them, even if Tenant 99 has a valid service (999) and patient (999).
      const payload = {
        patientId: 999,
        doctorId: 101, // Belongs to 42
        roomId: 12,    // Belongs to 42
        serviceId: 999,
        startsAt: '2026-10-17T14:00:00.000Z'
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('X-Tenant-Id', '99') 
        .send(payload);
      
      // We expect the system to deny this because doctor/room doesn't belong to tenant 99.
      expect(response.status).not.toBe(201);
      expect([400, 403, 404]).toContain(response.status); 
    });
  });

  describe('Working Hours and Breaks Validation', () => {
    beforeAll(async () => {
      // Masukkan jadwal cuti (Break) untuk Dr. Smith (101) di Klinik 42
      // Tanggal 16 Okt 2026, dari jam 13:00 s/d 14:00 UTC (15:00 s/d 16:00 Berlin Time +02:00)
      await db.execute(sql`
        INSERT INTO breaks (tenant_id, resource_type, resource_id, starts_at, ends_at) 
        VALUES (42, 'doctor', 101, '2026-10-16 13:00:00+00', '2026-10-16 14:00:00+00')
        ON CONFLICT DO NOTHING;
      `);
    });

    it("rejects booking outside of doctor's working hours", async () => {
      const payload = {
        patientId: 556,
        doctorId: 101,
        roomId: 12,
        serviceId: 7, 
        startsAt: '2026-10-16T03:00:00+02:00' // 3 AM Berlin Time
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('X-Tenant-Id', '42')
        .send(payload);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("outside the doctor's working hours");
    });

    it('rejects booking that overlaps with a scheduled break', async () => {
      const payload = {
        patientId: 556,
        doctorId: 101,
        roomId: 12,
        serviceId: 7, 
        startsAt: '2026-10-16T15:15:00+02:00' // 15:15 Berlin Time (Menabrak break 13:00 UTC)
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('X-Tenant-Id', '42')
        .send(payload);
      
      expect(response.status).toBe(409);
      expect(response.body.error).toContain("scheduled break");
    });
  });

  describe('Core Patient Consultation Time Preservation', () => {
    it('returns exact requested patient consultation start time on doctor calendar schedule', async () => {
      // 1. Create a booking for 14:00 UTC (Thursday Oct 15 2026)
      const requestedTime = '2026-10-15T14:00:00.000Z';
      const createRes = await request(app)
        .post('/api/appointments')
        .set('X-Tenant-Id', '42')
        .send({
          patientId: 556,
          doctorId: 101,
          roomId: 12,
          serviceId: 7,
          startsAt: requestedTime
        });

      expect(createRes.status).toBe(201);

      // 2. Fetch doctor's schedule for that day
      const scheduleRes = await request(app)
        .get('/api/doctors/101/schedule?from=2026-10-15T00:00:00%2B00:00&to=2026-10-16T00:00:00%2B00:00')
        .set('X-Tenant-Id', '42');

      expect(scheduleRes.status).toBe(200);
      expect(scheduleRes.body.schedule.length).toBeGreaterThan(0);

      // 3. Verify that the schedule returns 09:30 (core start), NOT 09:25 (blocked start)
      const matchingAppt = scheduleRes.body.schedule.find((s: any) => new Date(s.startsAt).toISOString() === requestedTime);
      expect(matchingAppt).toBeDefined();
      expect(new Date(matchingAppt.startsAt).toISOString()).toBe(requestedTime);
    });
  });
}
);
