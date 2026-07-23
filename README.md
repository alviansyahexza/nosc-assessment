# Technical Assessment — Multi-Tenant Clinic Scheduling & Conflict Detection

> **Implementation:** Nosc Clinic Practice Management Core Service  
> **Tech Stack:** Node.js (Express + TypeScript + Drizzle ORM + Vitest) & React (Vite + TypeScript + `react-big-calendar` + `date-fns-tz`)  
> **Database:** PostgreSQL 16+ with `btree_gist` extension and `GiST` exclusion constraints.

---

## 🚀 Quick Start (How to Run)

### ⚡ Option A: Docker Compose (Recommended — 1 Command)

Run the full stack (PostgreSQL + Auto DDL/Seed + Backend API + Frontend UI) with a single command:

```bash
docker compose up --build
```

- **Frontend UI:** `http://localhost:5173`
- **Backend API & Swagger Docs:** `http://localhost:3000/docs`
- **PostgreSQL Database:** `localhost:5432` (`nosc_clinic` with DDL & Seed pre-loaded)

---

### 🛠️ Option B: Manual Local Setup (Without Docker)

#### 1. Database Setup
```bash
createdb -h localhost -U postgres nosc_clinic
psql -h localhost -U postgres -d nosc_clinic -f app_build/db/ddl.sql
psql -h localhost -U postgres -d nosc_clinic -f app_build/db/seed.sql
```

#### 2. Backend Setup & Run
```bash
cd app_build/backend
npm install
DATABASE_URL="postgres://postgres:mysecretpassword@localhost:5432/nosc_clinic" npm run dev
```

#### 3. Run Backend Tests
```bash
DATABASE_URL="postgres://postgres:mysecretpassword@localhost:5432/nosc_clinic" npm test
```

#### 4. Frontend Setup & Run
```bash
cd app_build/frontend
npm install
npm run dev
```

---

## 🧪 Quick API Testing (`sample_requests.http`)

You can test all API endpoints manually using the included REST Client file:
- Open [`sample_requests.http`](./sample_requests.http) in VS Code (with REST Client extension) or JetBrains HTTP Client.
- Run queries sequentially against Tenant #42 (`X-Tenant-Id: 42`).

---

## 📚 Documentation References

- **Architecture & Scaling:** [`DESIGN.md`](./DESIGN.md)
- **Ship Readiness & Rubric Audit:** [`ship-verification.md`](./ship-verification.md)
