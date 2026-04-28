import { useAuth0 } from '@auth0/auth0-react';
import './UserProfile.css';

export function UserProfile({ userProfile, onNavigate }) {
  const { user } = useAuth0();

  if (!userProfile) {
    return <div className="loading">Loading profile...</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {user?.picture && (
              <img src={user.picture} alt={user.name} />
            )}
          </div>
          <div className="profile-info">
            <h1>{user?.name || user?.email}</h1>
            <p className="profile-email">{user?.email}</p>
            <span className="profile-role">{userProfile.role}</span>
          </div>
        </div>

        <div className="profile-section">
          <h2>Account Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Email:</span>
              <span className="value">{user?.email}</span>
            </div>
            <div className="info-item">
              <span className="label">Role:</span>
              <span className="value">{userProfile.role}</span>
            </div>
            <div className="info-item">
              <span className="label">Member Since:</span>
              <span className="value">
                {new Date(userProfile.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Auth ID:</span>
              <span className="value" style={{ fontSize: '0.85rem' }}>
                {userProfile.auth0_sub}
              </span>
            </div>
          </div>
        </div>

        {userProfile.role === 'employer' && (
          <div className="profile-section">
            <h2>Employer Dashboard</h2>
            <p>You can post job openings and manage applications from candidates.</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => onNavigate?.('employer-dashboard')}>
                View Employer Dashboard
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate?.('post-job')}>
                Post a New Job
              </button>
            </div>
          </div>
        )}

        {userProfile.role === 'candidate' && (
          <div className="profile-section">
            <h2>Candidate Profile</h2>
            <p>Start browsing available positions and apply to roles that match your skills.</p>
            <button className="btn btn-primary">Browse Jobs</button>
          </div>
        )}
      </div>
    </div>
  );
}
