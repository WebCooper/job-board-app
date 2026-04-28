# Job Board Platform

Microservices-based job board platform with a Saga-orchestrated job posting flow, event-driven notifications, and a React UI.

## Core Services
- `services/jobs-service` - Job drafts/publish/rollback (PostgreSQL: `jobs_db`)
- `services/payment-service` - Simulated payments with randomized outcomes (PostgreSQL: `payments_db`)
- `services/application-service` - Saga orchestrator + candidate applications (PostgreSQL: `applications_db`)
- `services/notification-service` - RabbitMQ consumer + notification log (PostgreSQL: `notifications_db`)
- `services/auth-service` - User profile sync from Auth0/Kong headers (PostgreSQL: `jobboard_auth`)
- `job-board-ui` - React + Vite front-end

## Quick Start (Local Dev)

### 1) Start dependencies
- PostgreSQL (create the databases listed below)
- RabbitMQ (for notification events)
- Optional: Kong + Auth0 if testing the full auth flow

### 2) Create databases
Create users and databases (examples):

```sql
CREATE USER jobs_admin WITH PASSWORD 'jobs_password';
CREATE DATABASE jobs_db OWNER jobs_admin;

CREATE USER payment_admin WITH PASSWORD 'payment_password';
CREATE DATABASE payments_db OWNER payment_admin;

CREATE USER app_admin WITH PASSWORD 'app_password';
CREATE DATABASE applications_db OWNER app_admin;

CREATE USER notification_admin WITH PASSWORD 'notification_password';
CREATE DATABASE notifications_db OWNER notification_admin;

CREATE USER auth_admin WITH PASSWORD 'auth_password';
CREATE DATABASE jobboard_auth OWNER auth_admin;
```

Enable `pgcrypto` for UUIDs:

```sql
\c jobs_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
\c payments_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
\c applications_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
\c notifications_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 3) Configure services
Create `.env` files per service. Reference [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for templates.

### 4) Start services

```bash
cd services/jobs-service
npm install
node index.js
```

```bash
cd services/payment-service
npm install
node index.js
```

```bash
cd services/application-service
npm install
node index.js
```

```bash
cd services/notification-service
npm install
npm run start:dev
```

```bash
cd services/auth-service
npm install
node index.js
```

### 5) Start UI

```bash
cd job-board-ui
npm install
npm run dev
```

UI runs at `http://localhost:5173`.

## Quick Start (Kubernetes / Minikube)
Follow [k8s-manifests/README.md](k8s-manifests/README.md) to deploy the full stack, including Kong, Istio, Vault, and RabbitMQ.

## Example Dataset
- Job seed data: [services/jobs-service/seed.json](services/jobs-service/seed.json)

## DB Schemas
See [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md).

## Deliverables
Submission deliverables are documented in [docs/DELIVERABLES.md](docs/DELIVERABLES.md).

## Demo Scripts
Video demo outline and speaker scripts are in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).