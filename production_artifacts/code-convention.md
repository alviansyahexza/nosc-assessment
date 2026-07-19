# Code Conventions & Best Practices

This document outlines the coding standards for the NoscAi Clinic Scheduling project. The goal is to strike a balance between **Enterprise Best Practices** (Clean Architecture, Testability, Observability) and **Pragmatic Simplicity** (No over-engineering, fast iteration).

## 1. Architecture: Pragmatic Clean Architecture
- **Routes (`src/routes/`)**: Keep them extremely thin. Only responsible for defining endpoints and wiring up controllers.
- **Controllers (`src/controllers/`)**: Responsible for HTTP logic. 
  - Extract `req.body`, `req.params`, `req.query`, and `req.tenantId`.
  - Validate inputs using Zod.
  - Call the appropriate Service.
  - Send the HTTP response (`res.status(200).json(...)`).
- **Services (`src/services/`)**: The core brain. 
  - **Rule**: A Service MUST NOT know anything about HTTP (`req` or `res`). 
  - **Rule**: A Service MUST NOT use raw database drivers directly. It must accept a Repository via constructor injection.
- **Repositories (`src/repositories/`)**: The only layer that touches Drizzle ORM or `pg`. 
  - Implement an interface (e.g., `IAppointmentRepository`) to allow for easy mocking during unit tests.

## 2. Dependency Injection (Keep it Simple)
- We will use **Constructor Injection** for Repositories into Services.
- We will **NOT** use heavy DI frameworks (like Inversify or NestJS DI) to avoid over-engineering. Manual wiring in the Route or a simple factory function is sufficient.

## 3. Error Handling
- **Do not** return `res.status(400)` directly from a Service. 
- **Do** throw domain-specific Error classes from Services (e.g., `class ConflictError extends Error {}`).
- **Global Error Handler**: A single Express middleware at the end of `server.ts` will catch all thrown errors and map them to standard HTTP responses (e.g., `ConflictError` -> HTTP 409).

## 4. Validation (Zod)
- All incoming HTTP payloads MUST be validated using Zod schemas at the Controller level.
- Use Zod's inferred types (`z.infer<typeof schema>`) as the standard TypeScript types for DTOs to maintain a Single Source of Truth.

## 5. Logging (Pino)
- **Rule**: Never use `console.log`.
- Always use the `pino` logger instance.
- **Traceability**: The Express app uses `pino-http` to inject a `request-id` into `req.id`. When logging inside a controller or service, ensure the log context includes this ID so errors can be traced back to the exact HTTP request.

## 6. TypeScript Rules
- `strict: true` is enabled.
- Avoid `any`. Use `unknown` if the type is truly unknown, and narrow it down with Zod.
- Use `interface` for object shapes and class contracts (like Repositories). Use `type` for unions, intersections, and aliases.

## 7. Database (Drizzle ORM)
- All database interactions must go through Drizzle ORM.
- For complex conflict constraints (`EXCLUDE USING gist`), handle the PostgreSQL error code (`23P01`) inside the Repository layer and translate it into a readable domain error (e.g., `ConflictError`).
- **Timezones**: Always store time as `TIMESTAMPTZ` in UTC.

## 8. Testing Strategy
- **Unit Tests (`*.unit.test.ts`)**: Focus entirely on the `src/services/` layer. Mock the Repositories. Test time-math and business rules aggressively.
- **Integration Tests (`*.integration.test.ts`)**: Focus on testing the Express App end-to-end against a real Test Database (especially to verify PostgreSQL Concurrency/Locks). Use `Supertest`.
