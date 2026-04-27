import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { api, setupInterceptor } from './api/axios';
import { Navigation } from './components/Navigation';
import { JobListings } from './components/JobListings';
import { JobDetail } from './components/JobDetail';
import { ApplicationForm } from './components/ApplicationForm';
import { UserProfile } from './components/UserProfile';
import './App.css';

function App() {
  const {
    isLoading,
    isAuthenticated,
    error,
    loginWithRedirect: login,
    logout: auth0Logout,
    user,
    getAccessTokenSilently,
  } = useAuth0();

  const [userProfile, setUserProfile] = useState(null);
  const [currentPage, setCurrentPage] = useState('jobs');
  const [selectedJob, setSelectedJob] = useState(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [profileSyncError, setProfileSyncError] = useState(null);

  // 1. Setup the Axios interceptor once when the app loads
  useEffect(() => {
    setupInterceptor(getAccessTokenSilently);
  }, [getAccessTokenSilently]);

  // 2. Sync profile with the backend whenever authentication succeeds
  useEffect(() => {
    const syncProfile = async () => {
      if (isAuthenticated) {
        try {
          setProfileSyncError(null);
          // This hits Kong -> Auth Service -> PostgreSQL
          const response = await api.post('/api/v1/auth/profile');
          setUserProfile(response.data);
        } catch (err) {
          console.error('Backend Sync Failed:', err);
          setProfileSyncError('Failed to sync profile with database');
        }
      }
    };

    syncProfile();
  }, [isAuthenticated]);

  const signup = () => login({ authorizationParams: { screen_hint: 'signup' } });

  const handleNavigate = (page) => {
    setCurrentPage(page);
    setSelectedJob(null);
  };

  const handleSelectJob = (job) => {
    setSelectedJob(job);
  };

  const handleApplyJob = (job) => {
    setShowApplicationForm(true);
  };

  const handleCloseApplicationForm = () => {
    setShowApplicationForm(false);
    setSelectedJob(null);
  };

  const handleApplicationSuccess = () => {
    // Refresh jobs after successful application
    setCurrentPage('jobs');
  };

  if (isLoading) return <div className="app-loading">Loading...</div>;

  if (!isAuthenticated) {
    return (
      <main className="auth-page">
        <div className="auth-container">
          <h1 className="auth-title">JobBoard</h1>
          <p className="auth-subtitle">Find your next opportunity or hire top talent</p>

          {error && <p className="error-text">Error: {error.message}</p>}

          <div className="auth-buttons">
            <button className="btn btn-primary" onClick={signup}>
              Sign Up
            </button>
            <button className="btn btn-secondary" onClick={login}>
              Log In
            </button>
          </div>

          <p className="auth-footer">
            Already have an account? <button onClick={login} className="link-btn">Log in here</button>
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="app-container">
      <Navigation onNavigate={handleNavigate} currentPage={currentPage} userProfile={userProfile} />

      {profileSyncError && (
        <div className="sync-error-banner">{profileSyncError}</div>
      )}

      <main className="app-main">
        {currentPage === 'jobs' && !selectedJob && (
          <JobListings onSelectJob={handleSelectJob} userProfile={userProfile} />
        )}

        {selectedJob && (
          <JobDetail
            job={selectedJob}
            onBack={() => setSelectedJob(null)}
            onApply={handleApplyJob}
          />
        )}

        {currentPage === 'profile' && (
          <UserProfile userProfile={userProfile} />
        )}

        {currentPage === 'applications' && (
          <div className="coming-soon">
            <h2>My Applications</h2>
            <p>This feature will display your job applications history.</p>
          </div>
        )}

        {currentPage === 'post-job' && (
          <div className="coming-soon">
            <h2>Post a New Job</h2>
            <p>This feature is for employers to post new job openings.</p>
          </div>
        )}
      </main>

      {showApplicationForm && selectedJob && userProfile && (
        <ApplicationForm
          job={selectedJob}
          userProfile={userProfile}
          onClose={handleCloseApplicationForm}
          onSuccess={handleApplicationSuccess}
        />
      )}
    </div>
  );
}

export default App;
