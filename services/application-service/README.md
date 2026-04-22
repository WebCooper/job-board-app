# Application Service (Saga Orchestrator)

The Application Service acts as the "Brain" of the distributed system. It orchestrates complex, multi-service workflows using the Saga Pattern to ensure data consistency across isolated microservices.

## Prerequisites
- Node.js 22+
- npm
- PostgreSQL 15+
- Running `jobs-service` and `payment-service` instances

## Configuration
Create a `.env` file in this directory:

```env
PORT=3003
DATABASE_URL=postgresql://app_admin:app_password@localhost:5432/applications_db
JOBS_SERVICE_URL=http://localhost:3002
PAYMENT_SERVICE_URL=http://localhost:3004
```

Environment variables:
- `PORT`: HTTP port for this service (defaults to `3003`)
- `DATABASE_URL`: PostgreSQL connection string for the applications database
- `JOBS_SERVICE_URL`: Base URL of the Jobs Service
- `PAYMENT_SERVICE_URL`: Base URL of the Payment Service

## Database Setup
1. Create the database user and database (example):

```sql
CREATE USER app_admin WITH PASSWORD 'app_password';
CREATE DATABASE applications_db OWNER app_admin;
```

2. Enable `pgcrypto` (required by `gen_random_uuid()` used in table creation):

```sql
\c applications_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

On startup, the service auto-creates the `applications` table if it does not exist.

## Run Locally
1. Start dependencies first:
- `jobs-service` on port `3002`
- `payment-service` on port `3004`

2. Start this service:

```bash
npm install
node index.js
```

## Responsibilities
* **Distributed Transactions:** Manages the "Post a Job" workflow across the `jobs-service` and `payment-service`.
* **State Management:** Tracks the exact state of a transaction (`STARTED`, `DRAFT_CREATED`, `COMPLETED`, `ROLLED_BACK`) in its own `applications_db` to ensure resilience against system crashes.
* **Compensating Transactions:** Automatically triggers rollback events (e.g., deleting a draft job) if a downstream service (like payments) fails.

## Core API
* `POST /api/v1/application/post-job` - The single entry point for employers to create and pay for a job posting.

Example request:

```bash
curl -X POST http://localhost:3003/api/v1/application/post-job \
	-H "Content-Type: application/json" \
	-d '{
		"employer_id": "emp-123",
		"job_details": {
			"title": "Backend Engineer",
			"description": "Own and improve microservice APIs.",
			"salary_min": 85000,
			"salary_max": 125000
		},
		"payment_details": {
			"amount": 199.99
		}
	}'
```

Possible outcomes:
- `201 Created`: Job draft created, payment succeeded, job published, saga state becomes `COMPLETED`
- `402 Payment Required`: Payment failed, compensation deleted draft job, saga state becomes `ROLLED_BACK`
- `500 Internal Server Error`: Unexpected failure in orchestration or downstream services

## Local End-to-End Flow
1. Start PostgreSQL databases for all three services.
2. Start `jobs-service`.
3. Start `payment-service`.
4. Start `application-service`.
5. Execute the `POST /api/v1/application/post-job` request above.

You can repeat step 5 multiple times to observe both success and rollback scenarios because payment success is randomized.

## Tech Stack
Node.js, Express, Axios, PostgreSQL (`applications_db`), Docker