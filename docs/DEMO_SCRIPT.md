# Demo Video Script (<= 20 minutes)

This script is a suggested outline with speaker segments. Replace names and adjust durations to fit your final cut.

## Timeline Overview

1. Intro and agenda (1:00)
2. Architecture overview (3:00)
3. Core feature: Employer posts job (Saga success) (5:00)
4. Core feature: Payment failure + rollback (3:00)
5. Candidate application flow + notifications (4:00)
6. Wrap-up (2:00)

## Speaker Script

### Speaker 1: Host / PM (Intro)

- "Hi, we are the Job Board Platform team. In this demo, we will show the architecture and the main user flows: employer job posting with Saga orchestration, payment failure rollback, and candidate application notifications."
- "We will keep this under 20 minutes and focus on the core features."

### Speaker 2: Backend Lead (Architecture)

- "The platform is built as microservices with database-per-service. The application-service orchestrates a Saga across jobs-service and payment-service."
- "Jobs-service creates a DRAFT job, payment-service charges the employer, and on success the job is published. If payment fails, the orchestrator compensates by deleting the draft job."
- "We use RabbitMQ to publish events to the notification-service, which sends emails and stores notification logs."
- "The UI connects through an API gateway and uses Auth0 for login."

Screen actions:
- Show repo tree briefly
- Open [docs/DB_SCHEMA.md](DB_SCHEMA.md) and point to the tables
- Open [services/application-service/README.md](../services/application-service/README.md) for the Saga flow

### Speaker 3: Full Stack (Employer Posting Flow - Success)

- "I will trigger a job posting from the UI. This hits the application-service endpoint `POST /api/v1/application/post-job`."
- "Watch the responses: the job draft is created, payment succeeds, and the job is published."

Screen actions:
- Open the UI at `http://localhost:5173`
- Log in as employer
- Submit a new job
- Show logs in jobs-service and payment-service terminals
- Optionally call `GET /api/v1/jobs/employer/:employer_id`

### Speaker 4: Backend / QA (Payment Failure + Rollback)

- "The payment service has randomized outcomes. When it fails, the orchestrator deletes the draft job and returns a 402 response."
- "This demonstrates the Saga compensation behavior."

Screen actions:
- Trigger job posting until failure
- Show logs in application-service indicating rollback
- Optionally show jobs-service records to confirm the draft was removed

### Speaker 5: Backend / Messaging (Candidate Apply + Notifications)

- "Candidates can apply through `POST /api/v1/application/apply`."
- "Notification-service consumes events from RabbitMQ and records the notification in Postgres."

Screen actions:
- Submit a candidate application
- Show notification-service logs
- Optionally query the `notifications` table

### Speaker 1: Host (Wrap-up)

- "We demonstrated the core flows, the Saga rollback behavior, and event-driven notifications."
- "Thank you for watching."

## Optional Notes for Recording

- Use a split-screen at transitions (speaker camera + screen recording).
- If you want a clean run, pre-seed jobs from [services/jobs-service/seed.json](../services/jobs-service/seed.json).
- If short on time, skip the Auth0 login and call the API with curl or Postman.
