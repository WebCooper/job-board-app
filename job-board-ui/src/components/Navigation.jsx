import { useAuth0 } from '@auth0/auth0-react';
import './Navigation.css';

export function Navigation({ onNavigate, currentPage, userProfile }) {
  const { user, logout: auth0Logout } = useAuth0();

  const logout = () =>
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-left">
          <h2 className="nav-logo">JobBoard</h2>
          <div className="nav-links">
            <button
              className={`nav-link ${currentPage === 'jobs' ? 'active' : ''}`}
              onClick={() => onNavigate('jobs')}
            >
              Browse Jobs
            </button>
            {userProfile?.role !== 'employer' && (
              <button
                className={`nav-link ${currentPage === 'applications' ? 'active' : ''}`}
                onClick={() => onNavigate('applications')}
              >
                My Applications
              </button>
            )}
            {userProfile?.role === 'employer' && (
              <button
                className={`nav-link ${currentPage === 'employer-dashboard' ? 'active' : ''}`}
                onClick={() => onNavigate('employer-dashboard')}
              >
                Employer Dashboard
              </button>
            )}
            {userProfile?.role === 'employer' && (
              <button
                className={`nav-link ${currentPage === 'post-job' ? 'active' : ''}`}
                onClick={() => onNavigate('post-job')}
              >
                Post Job
              </button>
            )}
          </div>
        </div>

        <div className="nav-right">
          <div className="user-info">
            <span className="user-email">{user?.email}</span>
            {userProfile && (
              <span className="user-role">{userProfile.role}</span>
            )}
          </div>
          <button className="nav-link logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
