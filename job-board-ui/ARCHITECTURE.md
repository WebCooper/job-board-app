# Component Architecture & Data Flow

## Component Hierarchy

```
App (src/App.jsx) - Main router and state management
│
├─── Navigation (Navigation.jsx)
│    └─ Shows: Logo, nav links, user email, role, logout button
│    └─ Props: currentPage, onNavigate, userProfile
│    └─ Styles: Navigation.css
│
├─── JobListings (JobListings.jsx) - Job discovery
│    ├─ Shows: Job cards in grid, filters (search, location, type)
│    ├─ Props: onSelectJob, userProfile
│    ├─ State: jobs[], filters{search, location, jobType}, loading, error
│    ├─ API: GET /api/v1/jobs
│    └─ Styles: JobListings.css
│
├─── JobDetail (JobDetail.jsx) - Job posting view
│    ├─ Shows: Full job info, requirements, benefits, apply button
│    ├─ Props: job, onBack, onApply
│    ├─ State: None (prop-driven)
│    └─ Styles: JobDetail.css
│
├─── ApplicationForm (ApplicationForm.jsx) - Application modal
│    ├─ Shows: Form in modal overlay (phone, resume, cover letter, start date)
│    ├─ Props: job, userProfile, onClose, onSuccess
│    ├─ State: formData{resume, coverLetter, phoneNumber, preferredStartDate}, loading, error, success
│    ├─ API: POST /api/v1/application/apply
│    └─ Styles: ApplicationForm.css
│
├─── UserProfile (UserProfile.jsx) - Profile page
│    ├─ Shows: Avatar, name, email, role, account info, role-specific sections
│    ├─ Props: userProfile
│    ├─ State: None (prop-driven)
│    └─ Styles: UserProfile.css
│
└─── Auth Pages
     ├─ Login page (before auth) - Sign Up / Log In buttons
     └─ Main app (after auth) - All components above
```

## Data Flow

### Authentication Flow
```
User Opens App (http://localhost:5173)
    ↓
useAuth0 hook fetches auth status
    ↓
NOT authenticated? → Show login page (Sign Up / Log In buttons)
    ↓
Click Sign Up/Log In → Auth0 Universal Login
    ↓
User completes auth → Redirect to app with JWT
    ↓
setupInterceptor() adds Authorization header to all requests
    ↓
Axios interceptor → GET /api/v1/auth/profile → Kong → Auth Service → PostgreSQL
    ↓
User profile synced to userProfile state
    ↓
Show Job Listings + Navigation
```

### Job Browsing Flow
```
User on Job Listings page
    ↓
First render → fetch GET /api/v1/jobs → Display job cards
    ↓
User types in search/location/type → Filter jobs locally
    ↓
User clicks "View Details" → onSelectJob(job) → selectedJob state set
    ↓
JobDetail component renders with job details
    ↓
User clicks "Apply Now" → showApplicationForm = true
    ↓
ApplicationForm modal opens
```

### Job Application Flow
```
User fills out ApplicationForm
    ↓
Click "Submit Application"
    ↓
POST /api/v1/application/apply with:
{
  jobId: job.id,
  candidateId: userProfile.id,
  resume: formData.resume,
  coverLetter: formData.coverLetter,
  phoneNumber: formData.phoneNumber,
  preferredStartDate: formData.preferredStartDate
}
    ↓
Response received → Show success message
    ↓
After 2 seconds → Close form, return to job listings
```

## API Integration Points

### 1. Profile Sync (Auth-Service)
```
Endpoint: POST /api/v1/auth/profile
Method: POST
Headers: Authorization: Bearer <Auth0_JWT>
Purpose: Sync Auth0 user to PostgreSQL
Response: {id, auth0_sub, role, created_at}
Error Handling: Display in sync-error-banner
```

### 2. Job Listings (Jobs-Service)
```
Endpoint: GET /api/v1/jobs
Method: GET
Headers: Authorization: Bearer <Auth0_JWT>
Purpose: Fetch all published jobs
Response: [{id, title, company, location, type, salary, description, requirements, benefits, createdAt}, ...]
Filtering: Done on frontend (search, location, jobType)
Error Handling: Show error-message and no-jobs fallback
```

### 3. Job Application (Application-Service)
```
Endpoint: POST /api/v1/application/apply
Method: POST
Headers: Authorization: Bearer <Auth0_JWT>
Body: {
  jobId: number,
  candidateId: number,
  resume: string,
  coverLetter: string,
  phoneNumber: string,
  preferredStartDate: string
}
Purpose: Submit job application
Response: {id, jobId, candidateId, status, createdAt}
Error Handling: Show error-message in form
Success: Show success-message, auto-close after 2s
```

## State Management

### Global State (App.jsx)
```
const [userProfile, setUserProfile] = useState(null)
  → User's synced profile from database
  → Used by: Navigation, JobListings, ApplicationForm, UserProfile

const [currentPage, setCurrentPage] = useState('jobs')
  → Current page: 'jobs', 'profile', 'applications', 'post-job'
  → Used by: App (routing logic)

const [selectedJob, setSelectedJob] = useState(null)
  → Currently selected job for detail view
  → Used by: JobDetail

const [showApplicationForm, setShowApplicationForm] = useState(false)
  → Whether to show application modal
  → Used by: ApplicationForm

const [profileSyncError, setProfileSyncError] = useState(null)
  → Error message if profile sync fails
  → Displayed in: sync-error-banner
```

### Local State (Component-level)

**JobListings.jsx**
- jobs[] - fetched from API
- loading - API call in progress
- error - API error message
- filters - search, location, jobType

**ApplicationForm.jsx**
- formData - phone, resume, coverLetter, startDate
- loading - form submission in progress
- error - form error
- success - submission successful

## Component Props

| Component | Props | Type | Purpose |
|-----------|-------|------|---------|
| Navigation | onNavigate | func | Navigate to page |
| | currentPage | string | Highlight active nav item |
| | userProfile | obj | Display email and role |
| JobListings | onSelectJob | func | Handle job selection |
| | userProfile | obj | Pass to child components |
| JobDetail | job | obj | Display job details |
| | onBack | func | Return to listings |
| | onApply | func | Open application form |
| ApplicationForm | job | obj | Display job in form |
| | userProfile | obj | Get candidateId |
| | onClose | func | Close modal |
| | onSuccess | func | After successful submission |
| UserProfile | userProfile | obj | Display profile info |

## Styling Architecture

### Color Scheme
```
Primary Gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
Background: #f5f5f5
Surface: #ffffff
Text: #333333
Muted: #666666
Error: #c33 / #fee
Success: #28a745 / #e8f5e9
```

### Breakpoints
```
Desktop: 1200px+
Tablet: 768px - 1199px
Mobile: < 768px
```

### CSS Organization
```
App.css              - Global app styles, auth page, layout
Navigation.css       - Navbar styling
JobListings.css      - Job grid, filters, job cards
JobDetail.css        - Detail page, sections
ApplicationForm.css  - Modal, form fields
UserProfile.css      - Profile page layout
```

## Development Workflow

### Adding a New Feature
1. Create component in `src/components/NewComponent.jsx`
2. Create styling in `src/components/NewComponent.css`
3. Export component from component file
4. Import in `App.jsx`
5. Add to component hierarchy in render logic
6. Add state management if needed
7. Connect to API endpoint
8. Test with real data

### Adding a New Page
1. Create page component in `src/components/`
2. Add page name to `currentPage` state options
3. Add navigation link in `Navigation.jsx`
4. Add rendering logic in `App.jsx` (switch/if statements)
5. Add styling

### Adding API Calls
1. Use `api` from `src/api/axios.js` (has JWT interceptor)
2. Handle loading state
3. Handle error state and display error message
4. Parse response and update component state
5. Add error boundary if critical

## Testing Checklist

- [ ] App loads without errors
- [ ] Auth0 login/signup works
- [ ] Profile syncs to database
- [ ] Navigation appears with user info
- [ ] Job listings load and display
- [ ] Filters work (search, location, type)
- [ ] Job detail page opens and shows full info
- [ ] Application form opens in modal
- [ ] Application form submits successfully
- [ ] Success message appears
- [ ] Profile page shows correct user info
- [ ] Logout works
- [ ] Responsive design on mobile (768px)
- [ ] CORS errors don't appear
- [ ] JWT validation passes
- [ ] Error messages display properly

## Performance Considerations

1. **API Calls**: Minimize by:
   - Fetching jobs once on component mount
   - Filtering locally (search, location, type)
   - Using useState to cache responses

2. **Build Size**:
   - CSS: 12.82 KB (gzipped: 3.16 KB)
   - JS: 412.71 KB (gzipped: 127.78 KB)
   - Consider: Code splitting, lazy loading for future features

3. **Rendering**:
   - Job cards are simple components (fast rendering)
   - Filter updates trigger local re-renders only
   - No unnecessary context providers

## Security Considerations

1. **JWT Security**:
   - Auth0 tokens validated by auth-service
   - Axios interceptor automatically adds JWT to requests
   - CORS properly configured at Kong gateway

2. **Data Validation**:
   - Form validation on client (required fields)
   - Server-side validation on backend endpoints
   - Error messages don't expose sensitive info

3. **HTTPS**:
   - Production: Use HTTPS
   - Development: HTTP OK (localhost)
   - Secure cookies for Auth0

## Future Architecture Improvements

1. **State Management**: Consider Redux/Zustand for complex state
2. **API Client**: Extract Axios calls into service layer
3. **Error Handling**: Centralized error boundary component
4. **Loading States**: Skeleton screens for better UX
5. **Caching**: Implement service worker for offline support
6. **Code Splitting**: Lazy load pages for faster initial load
7. **Testing**: Add Jest/React Testing Library tests
