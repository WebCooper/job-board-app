# Job Board Platform Report

## Introduction

The Job Board Platform is a microservices-based system that supports employer job postings and candidate applications. The platform demonstrates distributed transaction handling using the Saga pattern, event-driven notifications through RabbitMQ, and a decoupled web UI. The primary goal of this project is to show how a real-world workflow can be decomposed into independent services while preserving data integrity and user experience.

Key objectives:
- Separate service responsibilities with a database-per-service pattern.
- Orchestrate a multi-step job posting flow with rollback on failure.
- Deliver user-facing features through a React UI and stable APIs.
- Record audit-grade notifications without coupling services directly.

## Architecture

### Service Decomposition
The system is split into dedicated services, each with its own data store:
- Jobs Service: draft, publish, and delete job postings (PostgreSQL `jobs_db`).
- Payment Service: simulate charges with randomized outcomes (PostgreSQL `payments_db`).
- Application Service: orchestrate Saga for job posting; handle candidate applications (PostgreSQL `applications_db`).
- Notification Service: consume RabbitMQ events and persist notification logs (PostgreSQL `notifications_db`).
- Auth Service: synchronize Auth0 identities into a local user profile store (PostgreSQL `jobboard_auth`).
- UI: React + Vite application with Auth0 integration.

### Saga Orchestration
The application-service executes a Saga workflow for the employer job posting:
1. Create a DRAFT job in jobs-service.
2. Charge employer in payment-service.
3. If payment succeeds, publish job in jobs-service.
4. If payment fails, delete the DRAFT job to compensate.

Saga state is persisted in the applications database so the system can recover and diagnose failures. The service also publishes success or failure events to RabbitMQ, which the notification-service consumes.

### Event-Driven Notifications
The notification-service subscribes to the `notifications` queue and stores all incoming event payloads in Postgres. This creates an audit trail and allows the email send result to be tracked. The service does not call other services directly; instead, required data is passed in the event payload.

### Deployment Options
The system runs locally with separate Node processes and Postgres instances. It can also be deployed to Kubernetes using the manifests under `k8s-manifests/`, including Kong for gateway routing, Istio for service mesh, and Vault for secrets.

## Implementation Steps

### 1) Repository Layout and Service Boundaries
We organized the repository by service under `services/` and created a dedicated `job-board-ui/` for the frontend. Each service ships with its own README, environment variables, and TypeORM entities.

### 2) Database Modeling
Each service defines its schema as a TypeORM entity. Schemas are synchronized on startup when `NODE_ENV` is not `production`. The schema summary is consolidated in [docs/DB_SCHEMA.md](DB_SCHEMA.md).

### 3) Saga Flow in Application Service
The application-service contains the job posting entry point:
- `POST /api/v1/application/post-job`
- It coordinates with jobs-service and payment-service.
- It updates Saga state based on success, payment failure, or rollback failure.

### 4) Payment Simulation
The payment-service uses a randomized outcome strategy to intentionally return failures for demo purposes. This makes it easy to demonstrate rollback behavior and error handling in the Saga flow.

### 5) Notifications
The application-service emits events on success or failure. The notification-service consumes these events, stores a JSON payload, and sends emails via Resend. The events are listed in the notification-service README.

### 6) Frontend
The React UI provides a minimal flow to browse jobs and create or manage postings. It integrates with Auth0 and routes through the API gateway, attaching bearer tokens via Axios interceptors.

### 7) Kubernetes Deployment
Kubernetes manifests are organized by service and dependency. The platform uses separate Postgres deployments, a RabbitMQ deployment for messaging, and a Kong gateway for ingress. Optional Istio manifests provide service mesh features. Vault supports secret injection for jobs-service and payment-service.

## Challenges Faced

1) Local vs Kubernetes secret management
Jobs-service and payment-service expect Vault-injected secrets in container runtime. This is ideal for Kubernetes, but adds friction for local development. We documented this clearly and provided a path to run locally with either Kubernetes or file-based secret injection.

2) Keeping services decoupled
The notification-service has to remain isolated with no direct calls to other services. This required careful payload design to ensure every event contains all data needed by the consumer.

3) Saga consistency and rollback visibility
It is easy to trigger the saga but harder to make its state transitions visible for demos. We added explicit logging and structured responses so that rollback behavior is observable.

4) Auth gateway integration
The Auth service relies on Kong to inject user identity headers. This required alignment between gateway configuration and application middleware to avoid mismatched headers.

5) Coordinating multiple runtime dependencies
The system depends on Postgres, RabbitMQ, and optional gateway components. We consolidated steps in the root README and created a configuration guide to reduce setup friction.

## Lessons Learned

- The Saga pattern works best when compensation is designed from the beginning, not added later. The rollback path is just as important as the success path.
- Event-driven architecture improves decoupling, but event payload design is critical. You must assume the consumer has no access to any other service.
- Database-per-service simplifies boundaries, but it requires extra discipline to avoid cross-service joins or implicit coupling.
- Clear documentation is essential when multiple services, dependencies, and environments (local vs Kubernetes) are in play.
- Demo readiness requires purposeful failure modes (like randomized payments) to illustrate system behavior reliably.

## Appendix

- Run steps: [README.md](../README.md)
- Config templates: [docs/CONFIGURATION.md](CONFIGURATION.md)
- Schemas: [docs/DB_SCHEMA.md](DB_SCHEMA.md)
- Demo script: [docs/DEMO_SCRIPT.md](DEMO_SCRIPT.md)
