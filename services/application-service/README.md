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
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

Environment variables:
- `PORT`: HTTP port for this service (defaults to `3003`)
- `DATABASE_URL`: PostgreSQL connection string for the applications database
- `JOBS_SERVICE_URL`: Base URL of the Jobs Service
- `PAYMENT_SERVICE_URL`: Base URL of the Payment Service
- `RABBITMQ_URL`: RabbitMQ connection string (defaults to `amqp://guest:guest@localhost:5672`)

## Database Setup
1. Create the database user and database (example):

```sql
CREATE USER app_admin WITH PASSWORD 'app_password';
CREATE DATABASE applications_db OWNER app_admin;
```

2. Enable `pgcrypto` (required by `gen_random_uuid()` default used by TypeORM entity IDs):

```sql
\c applications_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

On startup, the service initializes a TypeORM `DataSource` and automatically syncs the `applications` table schema in non-production environments (`NODE_ENV != production`).

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

## RabbitMQ Event Publishing
This service publishes events to the `notifications` queue to keep the Notification Service informed of job posting outcomes. Ensure RabbitMQ is running and accessible at the URL specified in `RABBITMQ_URL`.

### Published Events

| Event Type | Trigger | Payload |
|---|---|---|
| `job.published` | Job successfully published after payment | `job_id`, `employer_id`, `job_title`, `amount`, `payment_status`, `saga_id` |
| `job.payment_failed` | Payment fails during Saga Step 2 | `job_id`, `employer_id`, `saga_id`, `reason` |
| `job.system_error` | Unexpected system error or failed rollback | `job_id`, `employer_id`, `saga_id`, `reason`, `error_details` |

### Event Flow in the Saga
1. **Saga Success:** After the job is published (Step 3), a `job.published` event is sent to RabbitMQ.
2. **Payment Failure:** If Step 2 (payment) fails and rollback succeeds, a `job.payment_failed` event is sent.
3. **System Error:** If any unexpected error occurs or rollback fails, a `job.system_error` event is sent.

The Notification Service consumes these events and sends appropriate notifications to employers.

## Compensating Transactions

The Saga orchestrator handles failures gracefully:

1. **Payment Failure:** If the employer's card is declined (402 status), the orchestrator automatically:
   - Deletes the draft job from the Jobs Service
   - Updates Saga state to `ROLLED_BACK`
   - Publishes `job.payment_failed` event to notify the employer
   - Returns a clear error message to the client

2. **Rollback Failure:** If the rollback itself fails (e.g., Jobs Service is down), the orchestrator:
   - Logs a critical alarm
   - Updates Saga state to `SYSTEM_ERROR`
   - Publishes `job.system_error` event for manual intervention
   - Returns a system error response

3. **Saga State Tracking:** The saga state in the database is the source of truth for transaction state, enabling recovery after system crashes.

## Candidate API
* `POST /api/v1/application/apply` - Submit a job application for a published job.

Example request:

```bash
curl -X POST http://localhost:3003/api/v1/application/apply \
	-H "Content-Type: application/json" \
	-d '{
		"jobId": "38430fe9-4415-492b-a11d-0e026eb9b36b",
		"candidateId": 1,
		"resume": "sdgasg",
		"coverLetter": "sdgsadf",
		"phoneNumber": "gferg",
		"preferredStartDate": "2026-04-30"
	}'
```

Possible outcomes:
- `201 Created`: Application stored successfully.
- `400 Bad Request`: Required fields are missing or the date format is invalid.
- `404 Not Found`: The referenced job is not published or does not exist.
- `500 Internal Server Error`: Unexpected failure while validating or saving the application.

## Local End-to-End Flow
1. Start PostgreSQL databases for all three services.
2. Start `jobs-service`.
3. Start `payment-service`.
4. Start `application-service`.
5. Execute the `POST /api/v1/application/post-job` request above.

You can repeat step 5 multiple times to observe both success and rollback scenarios because payment success is randomized.

## Tech Stack
Node.js, Express, Axios, TypeORM, PostgreSQL (`applications_db`), RabbitMQ (amqplib), Docker