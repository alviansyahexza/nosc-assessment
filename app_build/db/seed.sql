-- Initial Database Seed Script (Manual QA Dataset)

-- 1. Insert a tenant (Clinic)
INSERT INTO tenants (id, name, timezone) VALUES (42, 'Nosc Clinic Berlin', 'Europe/Berlin');

-- 2. Insert resources
-- Doctors
INSERT INTO doctors (id, tenant_id, name) VALUES (101, 42, 'Dr. Smith');
INSERT INTO doctors (id, tenant_id, name) VALUES (102, 42, 'Dr. Jane');

-- Rooms
INSERT INTO rooms (id, tenant_id, name) VALUES (12, 42, 'X-Ray Room 1');
INSERT INTO rooms (id, tenant_id, name) VALUES (9, 42, 'Consultation Room A');

-- Devices
INSERT INTO devices (id, tenant_id, name, device_type) VALUES (3, 42, 'Ultrasound Machine', 'Ultrasound');

-- Patients
INSERT INTO patients (id, tenant_id, name, email) VALUES (555, 42, 'John Doe', 'john@example.com');
INSERT INTO patients (id, tenant_id, name, email) VALUES (556, 42, 'Alice Wonderland', 'alice@example.com');

-- 3. Insert Services (from the README example)
INSERT INTO services (id, tenant_id, name, duration_min, buffer_before_min, buffer_after_min) 
VALUES (7, 42, 'Advanced Ultrasound', 30, 5, 10);

-- Link Service to Device
INSERT INTO service_resources (service_id, device_id, tenant_id) VALUES (7, 3, 42);

-- 4. Setup Doctor Working Hours
-- Dr. Smith (101) works Monday (1) to Friday (5), 08:00 - 17:00 local time
INSERT INTO working_hours (tenant_id, doctor_id, weekday, start_local_time, end_local_time) VALUES 
(42, 101, 1, '08:00:00', '17:00:00'),
(42, 101, 2, '08:00:00', '17:00:00'),
(42, 101, 3, '08:00:00', '17:00:00'),
(42, 101, 4, '08:00:00', '17:00:00'),
(42, 101, 5, '08:00:00', '17:00:00');

-- Dr. Jane (102) works Monday to Wednesday, 09:00 - 15:00
INSERT INTO working_hours (tenant_id, doctor_id, weekday, start_local_time, end_local_time) VALUES 
(42, 102, 1, '09:00:00', '15:00:00'),
(42, 102, 2, '09:00:00', '15:00:00'),
(42, 102, 3, '09:00:00', '15:00:00');

-- 5. Setup Breaks
-- Dr. Smith takes lunch 12:00 - 13:00 on Sept 15, 2025.
-- NOTE: Time stored in UTC. 12:00 CEST (Berlin summer time) = 10:00 UTC.
INSERT INTO breaks (tenant_id, resource_type, resource_id, starts_at, ends_at)
VALUES (42, 'doctor', 101, '2025-09-15 10:00:00+00', '2025-09-15 11:00:00+00');
