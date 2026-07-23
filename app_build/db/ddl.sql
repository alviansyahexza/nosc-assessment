-- 1. Enable btree_gist extension for EXCLUDE constraints on scalar types (like integer for tenant_id)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Core Entities
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Europe/Berlin'
);

CREATE TABLE doctors (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    UNIQUE(tenant_id, id) -- Required for composite FK isolation
);

CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    UNIQUE(tenant_id, id)
);

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    UNIQUE(tenant_id, id)
);

CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50),
    UNIQUE(tenant_id, id)
);

CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    duration_min INT NOT NULL,
    buffer_before_min INT DEFAULT 0,
    buffer_after_min INT DEFAULT 0,
    UNIQUE(tenant_id, id)
);

CREATE TABLE service_resources (
    service_id INT NOT NULL,
    room_id INT,
    device_id INT,
    tenant_id INT NOT NULL,
    
    FOREIGN KEY (tenant_id, service_id) REFERENCES services(tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, room_id) REFERENCES rooms(tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, device_id) REFERENCES devices(tenant_id, id) ON DELETE CASCADE,
    
    CHECK (room_id IS NOT NULL OR device_id IS NOT NULL)
);

-- 3. Scheduling Rules
CREATE TABLE working_hours (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL,
    doctor_id INT NOT NULL,
    weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_local_time TIME NOT NULL,
    end_local_time TIME NOT NULL,
    FOREIGN KEY (tenant_id, doctor_id) REFERENCES doctors(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE breaks (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('doctor', 'room', 'device')),
    resource_id INT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL
);

-- 4. The Booking Engine (Appointments)
-- Note: In a production system scaling past millions of rows, 
-- this table would use Declarative Partitioning: PARTITION BY RANGE (starts_at)
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL,
    doctor_id INT NOT NULL,
    patient_id INT NOT NULL,
    room_id INT NOT NULL,
    service_id INT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    blocked_starts_at TIMESTAMPTZ,
    blocked_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite Foreign Keys to strictly enforce tenant isolation
    FOREIGN KEY (tenant_id, doctor_id) REFERENCES doctors(tenant_id, id),
    FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id),
    FOREIGN KEY (tenant_id, room_id) REFERENCES rooms(tenant_id, id),
    FOREIGN KEY (tenant_id, service_id) REFERENCES services(tenant_id, id),
    
    CHECK (ends_at > starts_at),
    UNIQUE(tenant_id, id)
);

-- Conflict Detection Engine: Database-Level Guard against Race Conditions
ALTER TABLE appointments ADD CONSTRAINT no_overlapping_doctor_appts
EXCLUDE USING gist (
    tenant_id WITH =,
    doctor_id WITH =,
    tstzrange(COALESCE(blocked_starts_at, starts_at), COALESCE(blocked_ends_at, ends_at)) WITH &&
);

ALTER TABLE appointments ADD CONSTRAINT no_overlapping_room_appts
EXCLUDE USING gist (
    tenant_id WITH =,
    room_id WITH =,
    tstzrange(COALESCE(blocked_starts_at, starts_at), COALESCE(blocked_ends_at, ends_at)) WITH &&
);

-- Join table for devices, also featuring EXCLUDE constraints
CREATE TABLE appointment_devices (
    appointment_id INT NOT NULL,
    device_id INT NOT NULL,
    tenant_id INT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    blocked_starts_at TIMESTAMPTZ,
    blocked_ends_at TIMESTAMPTZ,
    
    PRIMARY KEY (appointment_id, device_id),
    FOREIGN KEY (tenant_id, appointment_id) REFERENCES appointments(tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, device_id) REFERENCES devices(tenant_id, id) ON DELETE CASCADE,
    
    CONSTRAINT no_overlapping_device_appts
    EXCLUDE USING gist (
        tenant_id WITH =,
        device_id WITH =,
        tstzrange(COALESCE(blocked_starts_at, starts_at), COALESCE(blocked_ends_at, ends_at)) WITH &&
    )
);

-- 5. Indexing Strategy for Fast Availability Search
CREATE INDEX idx_appt_tenant_doctor_time ON appointments (tenant_id, doctor_id, starts_at);
CREATE INDEX idx_appt_tenant_room_time ON appointments (tenant_id, room_id, starts_at);
CREATE INDEX idx_breaks_tenant_resource_time ON breaks (tenant_id, resource_type, resource_id, starts_at);
