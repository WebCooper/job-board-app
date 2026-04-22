# Payment Service

The Payment Service is a simulated microservice responsible for handling employer charges during the job posting flow. It manages its own isolated PostgreSQL database (`payments_db`).

## Prerequisites
- Node.js 22+
- npm
- PostgreSQL 15+

## Configuration
Create a `.env` file in this directory:

```env
PORT=3004
DATABASE_URL=postgresql://payment_admin:payment_password@localhost:5432/payments_db
```

Environment variables:
- `PORT`: HTTP port for this service (defaults to `3004`)
- `DATABASE_URL`: PostgreSQL connection string for the payments database

## Database Setup
1. Create the database user and database (example):

```sql
CREATE USER payment_admin WITH PASSWORD 'payment_password';
CREATE DATABASE payments_db OWNER payment_admin;
```

2. Enable `pgcrypto` (required by `gen_random_uuid()` used in table creation):

```sql
\c payments_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

On startup, the service auto-creates the `payments` table if it does not exist.

## Run Locally
```bash
npm install
node index.js
```

Health check:

```bash
curl http://localhost:3004/health
```

## Responsibilities
* **Mock Billing:** Simulates a third-party payment gateway (like Stripe).
* **Randomized Outcomes:** Intentionally designed with a 70% success rate and 30% failure rate (Insufficient Funds). This allows the system to easily demonstrate Saga rollbacks and compensating transactions during live demos.

## Internal APIs (Used by Saga Orchestrator)
* `POST /api/v1/payments/charge` - Attempts to charge an employer. Returns `200 OK` on success, or `402 Payment Required` on failure.

Example request:

```bash
curl -X POST http://localhost:3004/api/v1/payments/charge \
	-H "Content-Type: application/json" \
	-d '{
		"employer_id": "emp-123",
		"job_id": "job-456",
		"amount": 199.99
	}'
```

Possible responses:
- `200 OK` with a payment record where `status` is `SUCCESS`
- `402 Payment Required` with `error: "Insufficient funds"` and payment details
- `500 Internal Server Error` for unexpected failures

## Tech Stack
Node.js, Express, PostgreSQL (`payments_db`), Docker