import { pgTable, serial, integer, varchar, timestamp } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  timezone: varchar('timezone').default('Europe/Berlin'),
});

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  name: varchar('name').notNull(),
  durationMin: integer('duration_min').notNull(),
  bufferBeforeMin: integer('buffer_before_min').default(0),
  bufferAfterMin: integer('buffer_after_min').default(0),
});

export const serviceResources = pgTable('service_resources', {
  serviceId: integer('service_id').notNull(),
  roomId: integer('room_id'),
  deviceId: integer('device_id'),
  tenantId: integer('tenant_id').notNull(),
});

export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  doctorId: integer('doctor_id').notNull(),
  patientId: integer('patient_id').notNull(),
  roomId: integer('room_id').notNull(),
  serviceId: integer('service_id').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const appointmentDevices = pgTable('appointment_devices', {
  appointmentId: integer('appointment_id').notNull(),
  deviceId: integer('device_id').notNull(),
  tenantId: integer('tenant_id').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
});
