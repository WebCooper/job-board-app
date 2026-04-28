# Notification Service

Consumes RabbitMQ events and sends transactional emails via Resend. Persists every notification attempt to PostgreSQL for auditability.

## Stack

- **NestJS** — framework (hybrid HTTP + RabbitMQ microservice)
- **TypeORM** — ORM for PostgreSQL with entity-based schema sync
- **PostgreSQL** — notification log (status, payload, errors)
- **RabbitMQ** — event consumer (manual ack, durable queue)
- **Resend** — email delivery

## Event Types

| Event | Recipient | Trigger |
|---|---|---|
| `application.submitted` | Candidate + Employer | Candidate applies |
| `application.screened` | Candidate | Status → Screened |
| `application.interview` | Candidate | Status → Interview |
| `application.hired` | Candidate | Status → Hired |
| `application.rejected` | Candidate | Status → Rejected |
| `job.published` | Employer | Saga step 4 complete |
| `job.payment_failed` | Employer | Saga payment failure |
| `job.system_error` | Employer | Saga rollback/system failure |
| `job.new_applicant` | Employer | Standalone applicant notify |

## Quick Start

```bash
# fill in RESEND_API_KEY + RESEND_FROM in .env
docker-compose up
```

## Database Configuration

Set PostgreSQL environment variables in `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=notification_admin
DB_PASSWORD=notification_password
DB_NAME=notifications_db
```

On startup, the service initializes TypeORM and synchronizes the `notifications` table from entity metadata when `NODE_ENV` is not `production`.

## Publishing an Event from other services

Publish a Nest RMQ packet to the `notifications` queue. The event payload must be inside `data`.

**Application event packet:**
```json
{
  "pattern": "notifications",
  "data": {
    "eventType": "application.submitted",
    "applicationId": "uuid",
    "jobId": "uuid",
    "jobTitle": "Senior Engineer",
    "candidateEmail": "candidate@example.com",
    "candidateName": "Jane Doe",
    "employerEmail": "hr@company.com",
    "employerCompany": "Acme Corp"
  }
}
```

**Job success event packet:**
```json
{
  "pattern": "notifications",
  "data": {
    "eventType": "job.published",
    "jobId": "uuid",
    "jobTitle": "Senior Engineer",
    "employerEmail": "hr@company.com",
    "employerName": "John Smith"
  }
}
```

**Job payment failure event packet:**
```json
{
  "pattern": "notifications",
  "data": {
    "eventType": "job.payment_failed",
    "jobId": "uuid",
    "jobTitle": "Senior Engineer",
    "employerEmail": "hr@company.com",
    "employerName": "John Smith",
    "failureReason": "Payment declined - insufficient funds"
  }
}
```

**Job system error event packet:**
```json
{
  "pattern": "notifications",
  "data": {
    "eventType": "job.system_error",
    "jobId": "uuid",
    "jobTitle": "Senior Engineer",
    "employerEmail": "hr@company.com",
    "employerName": "John Smith",
    "failureReason": "Rollback failed during payment compensation"
  }
}
```

## Project Structure

```
src/
├── email/
│   ├── email.module.ts               # Resend wrapper module
│   └── email.service.ts              # send() method
├── notifications/
│   ├── dto/
│   │   └── notification-event.dto.ts # validated event shapes
│   ├── entities/
│   │   └── notification.entity.ts    # PostgreSQL record
│   ├── enums/
│   │   └── notification.enum.ts      # event types + statuses
│   ├── notification.templates.ts     # HTML email per event type
│   ├── notifications.consumer.ts     # RabbitMQ @EventPattern handler
│   ├── notifications.module.ts
│   └── notifications.service.ts      # routing + persistence logic
├── app.module.ts
└── main.ts                           # hybrid bootstrap
```

## Key Design Decisions

- **Manual ACK** — message is only acknowledged after the DB write succeeds. A failed email is recorded as `FAILED` but still ACKed — bad emails shouldn't block the queue.
- **NACK without requeue** on unhandled exceptions — sends to the dead-letter exchange rather than causing an infinite retry loop.
- **Payload stored as JSONB** — every original event is persisted for debugging and potential replays.
- **No calls to other services** — all required data must be in the event payload (enforced by validation DTOs). This keeps the service decoupled and respects the K8s network policy.