# Job Board UI

Minimal React + Vite frontend for the job board platform, with:

- Auth0 session management via `@auth0/auth0-react`
- Axios request interceptor that auto-attaches bearer tokens
- Simple routing for a public jobs page and protected dashboard

## Prerequisites

- Node.js 18+
- Running API Gateway (Kong)
- Auth0 application configured for SPA login

## Environment Variables

Create or update `.env`:

```env
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=https://jobboard-api
VITE_API_GATEWAY_URL=http://localhost:8000
```

## Run Locally

```bash
npm install
npm run dev
```

App runs on `http://localhost:5173` by default.

## Auth0 Dashboard Configuration

In Auth0 Dashboard -> Applications -> Your React Application, set all of these to:

- Allowed Callback URLs: `http://localhost:5173`
- Allowed Logout URLs: `http://localhost:5173`
- Allowed Web Origins: `http://localhost:5173`

Save changes.

## Current UI Flow

1. App bootstraps `Auth0Provider` in `src/main.jsx`.
2. Axios interceptor in `src/api/axios.js` calls `getAccessTokenSilently()` and sets `Authorization: Bearer <token>`.
3. On successful login, `src/App.jsx` syncs user profile via `POST /api/v1/auth/profile`.
4. Public route `/` shows minimal job listings.
5. Protected route `/dashboard` is accessible only when authenticated.
