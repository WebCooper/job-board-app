# Quick Start: Testing the Job Board App

## Prerequisites
- Kubernetes cluster running (Minikube)
- Kong gateway configured at `http://localhost:8000`
- Auth0 configured
- Auth-service and postgres-auth running

## Start the Development Server

```bash
cd job-board-ui
npm run dev
```

Then open: **http://localhost:5173**

## Test Flow

### 1. **Authentication**
- Click "Sign Up" (or "Log In")
- Complete Auth0 Universal Login
- App should redirect back with Auth0 token
- Profile syncs automatically to PostgreSQL via Auth Service

### 2. **Browse Job Listings**
- After login, you'll see the Job Listings page
- Jobs are fetched from `/api/v1/jobs` endpoint
- Try filtering by:
  - Search term (title, company, description)
  - Location
  - Job type

### 3. **View Job Details**
- Click "View Details" on any job card
- See full job description, requirements, benefits
- Click "Apply Now" to open application form

### 4. **Submit Application**
- Fill out the application form:
  - Phone Number (required)
  - Resume/CV (required)
  - Cover Letter (optional)
  - Start Date (optional)
- Click "Submit Application"
- Success message appears
- Application submits to `/api/v1/application/apply`

### 5. **View Profile**
- Click user email in top-right nav
- Navigate to profile page (future link)
- See synced user info from database

## Troubleshooting

### "Failed to sync profile"
- Check auth-service is running: `kubectl logs -l app=auth-service`
- Verify Kong can reach auth-service: `curl http://localhost:8000/api/v1/auth/health`

### "No jobs appear"
- Check jobs-service is running: `kubectl get pods -l app=jobs-service`
- Verify jobs exist in database: `kubectl exec <jobs-pod> -- psql...`

### CORS errors
- Check Kong has CORS plugin: `kubectl get kongplugins -A`
- Verify cors-plugin in ingress annotations

### JWT validation fails
- Check Auth0 domain is correct in `.env`
- Verify `VITE_AUTH0_AUDIENCE` matches Auth0 API identifier
- Check auth-service JWT middleware is validating correctly

## File Structure
```
job-board-ui/
├── src/
│   ├── components/          # New components
│   │   ├── Navigation.jsx
│   │   ├── JobListings.jsx
│   │   ├── JobDetail.jsx
│   │   ├── ApplicationForm.jsx
│   │   ├── UserProfile.jsx
│   │   └── *.css            # Component styling
│   ├── api/
│   │   └── axios.js         # Axios instance with JWT interceptor
│   ├── App.jsx              # Main app router
│   ├── App.css              # App styling
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── .env                     # Auth0 configuration
├── FEATURES.md              # Feature documentation
└── package.json
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/profile` | POST | Sync user profile |
| `/api/v1/jobs` | GET | Fetch all jobs |
| `/api/v1/application/apply` | POST | Submit job application |
| `/api/v1/auth/users/:id` | GET | Get user by ID |

## Environment Variables (.env)
```
VITE_AUTH0_DOMAIN=dev-tcizcdzuftlsdihd.ca.auth0.com
VITE_AUTH0_CLIENT_ID=d99Oz8RiDUR5wuYjcHmqLwaBQvlx4o2X
VITE_AUTH0_AUDIENCE=https://jobboard-api
VITE_API_GATEWAY_URL=http://localhost:8000
```

## Build for Production
```bash
npm run build
```

Output goes to `dist/` directory. Ready to deploy!

## Development Tips

- Hot reload enabled: Edit any component and see changes immediately
- Browser DevTools:
  - Check Network tab for API calls
  - Check Console for errors
  - Check Application tab for Auth0 token
- Backend logs: `kubectl logs -l app=auth-service -f`
- Kong logs: `kubectl logs -n kong kong-gateway-* -f`

## Next Steps

1. **Complete API Implementation**:
   - Ensure `/api/v1/jobs` returns published jobs
   - Implement `/api/v1/application/apply` in application-service
   - Add application-service integration with payment-service

2. **Add More Features**:
   - My Applications page
   - Post Job page (for employers)
   - Job bookmarks
   - User profile editing
   - Search/filter on backend

3. **Testing**:
   - Run with real job data
   - Test application flow end-to-end
   - Verify payment processing for premium applications
