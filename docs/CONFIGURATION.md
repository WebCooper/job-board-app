# Configuration Templates

This document consolidates the environment variables needed to run the platform locally.

## jobs-service
Create `services/jobs-service/.env`:

```env
PORT=3002
DATABASE_URL=postgresql://jobs_admin:jobs_password@localhost:5432/jobs_db
```

Note: the current code path in `jobs-service` reads the DB URL from a Vault-injected file at `/vault/secrets/database`. For local dev, use one of the following:
- Run via Kubernetes + Vault (recommended), or
- Provide a file at `/vault/secrets/database` that contains the Postgres URL (Linux/WSL/Docker), or
- Add a local-only fallback (not included in this repo by default).

## payment-service
Create `services/payment-service/.env`:

```env
PORT=3004
DATABASE_URL=postgresql://payment_admin:payment_password@localhost:5432/payments_db
```

Note: the current code path in `payment-service` reads the DB URL from a Vault-injected file at `/vault/secrets/database`. For local dev, use one of the following:
- Run via Kubernetes + Vault (recommended), or
- Provide a file at `/vault/secrets/database` that contains the Postgres URL (Linux/WSL/Docker), or
- Add a local-only fallback (not included in this repo by default).

## application-service
Create `services/application-service/.env`:

```env
PORT=3003
DATABASE_URL=postgresql://app_admin:app_password@localhost:5432/applications_db
JOBS_SERVICE_URL=http://localhost:3002
PAYMENT_SERVICE_URL=http://localhost:3004
RABBITMQ_URL=amqp://guest:guest@localhost:5672
NOTIFICATION_FALLBACK_EMAIL=alerts@example.com
```

## notification-service
Create `services/notification-service/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=notification_admin
DB_PASSWORD=notification_password
DB_NAME=notifications_db
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=notifications@example.com
```

## auth-service
Create `services/auth-service/.env`:

```env
PORT=3001
DATABASE_URL=postgresql://auth_admin:auth_password@localhost:5432/jobboard_auth
```

## job-board-ui
Create `job-board-ui/.env`:

```env
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=https://jobboard-api
VITE_API_GATEWAY_URL=http://localhost:8000
```
