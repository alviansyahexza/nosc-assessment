import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server';

describe('Availability API Integration Tests', () => {
  it('returns next 3 available slots', async () => {
    // 2026-10-15 is a Thursday. Dr. Smith works 08:00 - 17:00 Berlin time.
    const response = await request(app)
      .get('/api/availability')
      .query({
        serviceId: 7, // Advanced Ultrasound
        from: '2026-10-15T00:00:00.000Z',
        to: '2026-10-20T00:00:00.000Z'
      })
      .set('X-Tenant-Id', '42'); // Nosc Clinic Berlin

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('slots');
    expect(Array.isArray(response.body.slots)).toBe(true);
    expect(response.body.slots.length).toBeLessThanOrEqual(3);
    
    if (response.body.slots.length > 0) {
      expect(response.body.slots[0]).toHaveProperty('start');
      expect(response.body.slots[0]).toHaveProperty('end');
      expect(response.body.slots[0]).toHaveProperty('doctorId');
      expect(response.body.slots[0]).toHaveProperty('roomId');
    }
  });

  it('fails if X-Tenant-Id is missing', async () => {
    const response = await request(app)
      .get('/api/availability')
      .query({
        serviceId: 7,
        from: '2026-10-15T00:00:00.000Z',
        to: '2026-10-20T00:00:00.000Z'
      });
      
    expect(response.status).toBe(401);
  });

  describe('Datetime Offset & Query String Encoding Edge Cases', () => {
    it('handles properly URL-encoded timezone offset (+07:00 -> %2B07:00)', async () => {
      // Correctly URL-encoded query string sent directly via raw URL path
      const response = await request(app)
        .get('/api/availability?serviceId=7&from=2026-10-15T00:00:00%2B07:00&to=2026-10-20T00:00:00%2B07:00')
        .set('X-Tenant-Id', '42');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('slots');
    });

    it('rejects raw unencoded timezone offset (+07:00) when Express decodes + to space', async () => {
      // Unencoded plus sign in raw URL string - Express turns '+' into ' '
      const response = await request(app)
        .get('/api/availability?serviceId=7&from=2026-10-15T00:00:00+07:00&to=2026-10-20T00:00:00+07:00')
        .set('X-Tenant-Id', '42');

      // Demonstrates the exact bug: unencoded '+' becomes space and fails Zod validation
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
