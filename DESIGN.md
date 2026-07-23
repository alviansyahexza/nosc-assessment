# System Design: Nosc Clinic Scheduling

This document explains the core technical decisions behind the scheduling system in a simple and concise way.

## 1. Multi-Tenant Isolation
**Goal:** Prevent clinics from seeing or editing each other's data.
- **How it works:** Every single table in the database has a `tenant_id` column. 
- **Security:** The backend forces every database query to filter by `tenant_id`. If User A belongs to Clinic 1, they physically cannot query data for Clinic 2.

## 2. Timezone-Blinded Architecture
**Goal:** Prevent bugs caused by timezone differences or Daylight Saving Time (DST).
- **How it works:** The Backend ignores the server's timezone. Instead, it extracts the raw time (e.g., `09:30`) directly from the text sent by the Frontend.
- **Why it matters:** All calculations (like adding 30 minutes for a service) are done using this raw time. The database simply saves the final result in standard UTC.

## 3. Preventing Double Bookings (Conflicts & Race Conditions)
**Goal:** Stop two patients from booking the same doctor or room at the exact same time.
- **Overlap Logic:** The system strictly rejects any new booking if its time intersects with an existing appointment or a doctor's break.
- **Race Conditions:** If two users click "Book" at the exact same millisecond, the database (PostgreSQL) uses Transactions to lock the data. One user succeeds, and the other safely receives a "Conflict" error.

## 4. Performance & Scaling (50k Bookings/Day)
**Goal:** Keep the "Availability Search" extremely fast (< 300ms) even with heavy traffic.
- **Smart Algorithm:** Instead of testing every possible 15-minute slot one by one, the backend fetches all existing appointments in a single query and mathematically calculates the gaps.
- **Database Indexing:** We added specific "Indexes" on the database combining `tenant_id`, `doctor_id`, and `starts_at`. This acts like a book's table of contents, allowing PostgreSQL to find free slots instantly without reading the whole database.
