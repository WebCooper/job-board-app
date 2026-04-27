# Auth Service

The Auth Service acts as the localized profile registry for the Job Board platform. Because authentication and JWT validation are handled upstream by the Kong API Gateway, this service is completely stateless regarding cryptographic token verification.

Instead, it relies on Kong injecting validated claims into the request headers to synchronize Auth0 identities with our internal PostgreSQL database.

## Architecture Context

1. Client logs into Auth0 and receives a JWT.
2. Client sends a request with the `Authorization: Bearer <token>` header to the Kong Gateway.
3. Kong validates the JWT signature and expiration.
4. If valid, Kong strips the JWT (optional) and injects the user's claims (like `sub` and `roles`) into standard HTTP headers (for example, `X-User-Sub`, `X-User-Role`).
5. Kong forwards the request to the target microservice.
6. Auth Service (and other services) reads these headers to establish the user's context.

---

## Endpoints

### 1. Sync User Profile
**`POST /api/v1/auth/profile`**

Called immediately after a user successfully logs into the client application. It checks if the Auth0 user exists in the local database. If not, it creates a new record.

- Authentication: Handled by Kong.
- Required Headers (Injected by Kong):
  - `X-User-Sub`: The unique Auth0 identifier (for example, `auth0|123456...`)
  - `X-User-Role`: The user's primary role (for example, `employer` or `candidate`)
- Request Body: None required.
- Response (`200 OK`):

```json
{
  "id": 1,
  "auth0_sub": "auth0|69ef729b...",
  "role": "employer",
  "created_at": "2026-04-27T10:00:00.000Z"
}
```

### 2. Get User Profile by Internal ID
**`GET /api/v1/auth/users/:id`**

Fetches a user's basic profile details using their internal Postgres database ID. Used primarily for internal service-to-service checks or admin viewing.

- Authentication: Handled by Kong.
- Path Parameters:
  - `id`: The internal database integer ID.
- Response (`200 OK`):

```json
{
  "id": 1,
  "auth0_sub": "auth0|69ef729b...",
  "role": "employer",
  "created_at": "2026-04-27T10:00:00.000Z"
}
```

- Response (`404 Not Found`): User does not exist.

---

## Validations and Middleware

Since JWT validation is offloaded, the Express app only requires lightweight middleware to extract and validate the injected headers.

### Required Header Validation

Every protected endpoint in this service should pass through an identity extraction middleware that ensures Kong successfully passed the data:

```javascript
// Example middleware for Auth Service
const extractIdentity = (req, res, next) => {
  const sub = req.headers['x-user-sub'];
  const role = req.headers['x-user-role'];

  if (!sub) {
    return res.status(401).json({ error: 'Unauthorized: Missing User Identity Headers' });
  }

  req.user = { sub, role: role || 'candidate' };
  next();
};
```

### Database Constraints

- `auth0_sub`: Must be `UNIQUE` and `NOT NULL`. This prevents duplicate profile generation if the client calls the profile sync endpoint multiple times.
- `role`: Checked at the application level to ensure it falls within expected enums (`employer`, `candidate`).

---

## Integrating with Other Services

When building the remaining services (Jobs, Application, Payment), keep the following integration patterns in mind.

### 1. Services Trust Kong, Not the Client

Your microservices should never attempt to parse the JWT themselves. Every service (Jobs, Application, and so on) should use the same header-extraction middleware shown above to determine who is making the request.

### 2. Authorization (RBAC) Logic

While Kong validates that the user is who they say they are (authentication), your individual microservices enforce what they are allowed to do (authorization).

For example, in your Jobs Service:

```javascript
// Inside Jobs Service route handler
app.post('/api/v1/jobs', extractIdentity, async (req, res) => {
  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Forbidden: Only employers can post jobs' });
  }
  // Proceed to create job...
});
```

### 3. Avoiding Chatty Network Calls

Other services should not need to constantly call the Auth Service over the network.

- Because Kong injects the `X-User-Sub` and `X-User-Role` headers into every request, the Jobs or Application service already has the primary identity of the user.
- Only query the Auth Service if you specifically need the internal PostgreSQL `id` or historical creation data. Alternatively, you can use the `auth0_sub` string as the primary foreign key across all microservice databases to eliminate cross-service lookups entirely.

---

## Environment Variables

To run this service locally or in Kubernetes, the following variables are required:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The port the Express app listens on | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/jobboard_auth` |
