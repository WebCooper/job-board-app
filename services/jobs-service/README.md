# Jobs Service

The Jobs Service is a core microservice in the Job Board Platform responsible for managing the lifecycle of job postings. It utilizes the Database-per-Service pattern with its own isolated PostgreSQL instance.

## Prerequisites
- Node.js 22+ (or any currently supported LTS version)
- npm
- PostgreSQL 15+

## Configuration
Create a `.env` file in this directory:

```env
PORT=3002
DATABASE_URL=postgresql://jobs_admin:jobs_password@localhost:5432/jobs_db
```

Environment variables:
- `PORT`: HTTP port for this service (defaults to `3002`)
- `DATABASE_URL`: PostgreSQL connection string for the jobs database

## Database Setup
1. Create the database user and database (example):

```sql
CREATE USER jobs_admin WITH PASSWORD 'jobs_password';
CREATE DATABASE jobs_db OWNER jobs_admin;
```

2. Enable `pgcrypto` (required by `gen_random_uuid()` used in table creation):

```sql
\c jobs_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

On startup, the service auto-creates the `jobs` table if it does not exist.

## Run Locally
```bash
npm install
node index.js
```

Health check:

```bash
curl http://localhost:3002/health
```

## Responsibilities
* **Draft Creation:** Initializes job postings with a `DRAFT` status.
* **Publishing:** Updates job statuses to `PUBLISHED` upon successful payment.
* **Rollbacks (Compensating Transactions):** Exposes a hard-delete endpoint used by the Saga Orchestrator to remove draft jobs if a distributed transaction fails.

## Internal APIs - Used by Saga Orchestrator
* `POST /api/v1/jobs` - Create a draft job.
* `PUT /api/v1/jobs/:id/publish` - Publish a job.
* `DELETE /api/v1/jobs/:id` - Hard delete a draft job.

## Public APIs - Candidate Facing
The following public endpoints are planned but not implemented yet in the current code:
* `GET /api/v1/jobs` - List basic published jobs.
* `GET /api/v2/jobs` - Advanced search (Redis caching to be implemented in Phase 4).

## Example Internal Calls
Create draft job:

```bash
curl -X POST http://localhost:3002/api/v1/jobs \
	-H "Content-Type: application/json" \
	-d '{
		"employer_id": "emp-123",
		"title": "Senior Backend Engineer",
		"description": "Build scalable backend systems.",
		"salary_min": 90000,
		"salary_max": 130000
	}'
```

Publish job:

```bash
curl -X PUT http://localhost:3002/api/v1/jobs/<job_id>/publish
```

Delete draft (Saga compensation):

```bash
curl -X DELETE http://localhost:3002/api/v1/jobs/<job_id>
```

## Tech Stack
Node.js, Express, PostgreSQL (`jobs_db`), Docker