# System Architecture & Design Rationale (Sprint 1)

This document outlines the architectural decisions, database schema design, and conflict detection strategies for the NoscAi Multi-Tenant Clinic Scheduling System.

## 1. Multi-Tenant Isolation Strategy
**Decision:** Shared Database, Hard Partitioning via `tenant_id`
**Rationale:** 
For a system scaling to 50k bookings/day across multiple clinics, a shared database approach (one database, all tenants in the same tables) is the most resource-efficient. 
To guarantee strict isolation, **every single domain table** includes a `tenant_id` column.
- All primary keys are `id` (UUID or BigInt), but all API queries and database constraints must explicitly include `tenant_id = X`.
- This technically breaks strict 3NF (as `tenant_id` could be derived by joining up to the `clinics` table), but this intentional denormalization prevents accidental data leaks and avoids expensive 4-way joins just to verify ownership.

## 2. Core Database Schema (DDL Blueprint)

### Core Entities
- **`tenants`**: `id`, `name`, `timezone` (default 'Europe/Berlin')
- **`doctors`**: `id`, `tenant_id`, `name`
- **`patients`**: `id`, `tenant_id`, `name`, `email`
- **`rooms`**: `id`, `tenant_id`, `name`
- **`devices`**: `id`, `tenant_id`, `name`, `type`

### Scheduling Rules
- **`services`**: `id`, `tenant_id`, `name`, `duration_min`, `buffer_before_min`, `buffer_after_min`, `requires_room` (boolean)
- **`working_hours`**: `id`, `tenant_id`, `doctor_id`, `weekday` (0-6), `start_local_time`, `end_local_time` (Stored as `TIME` types, to be evaluated against the clinic's timezone).
- **`breaks`**: `id`, `tenant_id`, `resource_type` (Enum: doctor, room, device), `resource_id`, `starts_at`, `ends_at` (Stored as `TIMESTAMPTZ`).

### The Booking Engine
- **`appointments`**: 
  - `id`, `tenant_id`, `doctor_id`, `patient_id`, `room_id`, `service_id`
  - `starts_at` (`TIMESTAMPTZ`) - Includes `buffer_before_min`.
  - `ends_at` (`TIMESTAMPTZ`) - Includes `buffer_after_min`.
  - *Note: `ends_at` is pre-calculated and stored at booking time to protect historical records in case the service duration is altered in the future.*

- **`appointment_devices`**: `appointment_id`, `device_id`, `tenant_id`

## 3. Conflict Detection Engine (Race Condition Prevention)
**Decision:** PostgreSQL `EXCLUDE` Constraints
**Rationale:** 
Relying on Application-level checks (e.g., Node.js doing `SELECT` then `INSERT`) is vulnerable to race conditions under heavy concurrent load (two users booking the exact same millisecond).
Instead, we rely on PostgreSQL's `EXCLUDE USING gist` constraints to mathematically guarantee no overlaps exist at the database level.

We will implement the following database-level constraints:
1. **Doctor Overlap Guard**:
   ```sql
   ALTER TABLE appointments ADD CONSTRAINT no_overlapping_doctor_appts
   EXCLUDE USING gist (
       tenant_id WITH =,
       doctor_id WITH =,
       tstzrange(starts_at, ends_at) WITH &&
   );
   ```
2. **Room Overlap Guard**:
   ```sql
   ALTER TABLE appointments ADD CONSTRAINT no_overlapping_room_appts
   EXCLUDE USING gist (
       tenant_id WITH =,
       room_id WITH =,
       tstzrange(starts_at, ends_at) WITH &&
   );
   ```
*(Note: Device overlaps will be handled either via a similar constraint on the `appointment_devices` join table or via Serializable transactions, depending on performance testing).*

## 4. Indexing Strategy
To meet the <300ms SLA for the Availability Search, we will create composite indexes targeting the most common query patterns:
- `idx_appt_tenant_doctor_time (tenant_id, doctor_id, starts_at)`
- `idx_appt_tenant_room_time (tenant_id, room_id, starts_at)`
- `idx_breaks_tenant_resource_time (tenant_id, resource_type, resource_id, starts_at)`

## 5. Availability Algorithm & Data Structure Complexity
**The Challenge:** Calculating the next 3 available time slots for a service that requires a Doctor and a Room, while respecting working hours, breaks, and existing appointments.
**The Algorithm:** We will use an in-memory **Sweep-Line Algorithm (Interval Merging)** in Node.js.
1. **Fetch (Database):** Query the specific 1-7 day window to get all existing appointments and breaks for the requested resources (Doctor & Room). The DB lookup via B-Tree index is `O(log N)`.
2. **Sort & Merge (Node.js):** Sort all blocked intervals (appointments + buffers + breaks) chronologically. Merging overlapping intervals takes `O(M log M)` time complexity, where `M` is the number of blocked events in that small 7-day window.
3. **Find Gaps:** Subtract the merged blocked intervals from the Doctor's total working hours. Scan the resulting free time to find the first 3 gaps that are `>= (service_duration + buffers)`. This gap-finding scan is `O(M)`.
**Why not purely SQL?** Performing complex interval subtractions and finding "gaps" across multiple joined tables purely in SQL is computationally heavy and often slower than doing it in application memory with a tiny dataset.

## 6. Scale Considerations (50k Bookings/Day)
To comfortably handle 50k bookings/day (~3.5 writes/sec on average, ~15 writes/sec at peak) while keeping the Availability Search under 300ms:
- **Connection Pooling:** We assume the use of `PgBouncer` at the infrastructure level to prevent connection starvation during the 09:00-11:00 peak traffic.
- **Table Partitioning (Future-proofing):** As historical data piles up (18M rows/year), the GiST index used for the `EXCLUDE` constraint will bloat. We mitigate this by applying PostgreSQL Declarative Partitioning (by Month) on the `appointments` table. This keeps the active GiST index small and entirely in RAM.
- **Warm Cache:** We will cache static rules like `working_hours` and `services` in memory/Redis. Only the highly dynamic `appointments` and `breaks` tables will be queried directly.

## 7. Trade-Offs Made
1. **Denormalization vs. Strict 3NF:** We broke strict 3NF by placing `tenant_id` on every single table (including mapping tables). *Trade-off:* We sacrifice a tiny amount of storage space in exchange for massive security gains (preventing IDOR) and eliminating the need for expensive multi-table joins just to verify row ownership.
2. **Composite FKs vs Simple FKs:** We require Composite Foreign Keys (e.g., `(tenant_id, doctor_id)`) instead of simple ID references. *Trade-off:* Slightly more complex SQL statements, but it mathematically guarantees that a booking cannot mix a Doctor from Clinic A with a Room from Clinic B.
3. **Database Constraints vs Application Logic:** We pushed the burden of conflict detection down to the Database layer (GiST Exclude). *Trade-off:* Inserts are slightly slower than normal `INSERT` statements because the DB must check the index tree. However, this is the *only* way to guarantee 100% protection against race conditions without relying on aggressive and slow table locks.

---
## 8. Next Steps
Once this design is approved, the `@engineer` will translate this blueprint into actual `db/ddl.sql` and `db/seed.sql` files inside the `app_build/` directory.
