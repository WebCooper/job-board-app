import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/axios';
import './MyApplications.css';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

const getStatusClassName = (status) => {
  const normalizedStatus = `${status || ''}`.toLowerCase();

  if (normalizedStatus.includes('reject') || normalizedStatus.includes('fail')) {
    return 'status-badge status-badge-error';
  }

  if (normalizedStatus.includes('interview') || normalizedStatus.includes('review')) {
    return 'status-badge status-badge-warning';
  }

  if (normalizedStatus.includes('accept') || normalizedStatus.includes('hired')) {
    return 'status-badge status-badge-success';
  }

  return 'status-badge status-badge-neutral';
};

export function MyApplications({ userProfile }) {
  const candidateId = userProfile?.id;
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!candidateId) {
        setApplications([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await api.get(`/api/v1/application/candidate/${candidateId}`);
        setApplications(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to fetch candidate applications:', err);
        setError(err.response?.data?.message || 'Failed to load your applications. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [candidateId]);

  const applicationCount = useMemo(() => applications.length, [applications]);

  if (!candidateId) {
    return (
      <div className="applications-page">
        <div className="applications-header">
          <h1>My Applications</h1>
          <p>We need your profile before we can load your application history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="applications-page">
      <div className="applications-header">
        <div>
          <h1>My Applications</h1>
          <p>Track every role you have applied for from one place.</p>
        </div>
        <div className="applications-count">
          {applicationCount} {applicationCount === 1 ? 'application' : 'applications'}
        </div>
      </div>

      {error && <div className="applications-error">{error}</div>}

      {loading ? (
        <div className="applications-loading">Loading your applications...</div>
      ) : applications.length === 0 ? (
        <div className="applications-empty">
          <h2>No applications yet</h2>
          <p>Your submitted applications will appear here once you start applying to jobs.</p>
        </div>
      ) : (
        <div className="applications-list">
          {applications.map((application) => (
            <article key={application.id} className="application-card">
              <div className="application-card-header">
                <div>
                  <h2>Application #{application.id.slice(0, 8)}</h2>
                  <p>Job ID: {application.jobId}</p>
                </div>
                <span className={getStatusClassName(application.status)}>
                  {application.status || 'UNKNOWN'}
                </span>
              </div>

              <div className="application-card-body">
                <div className="application-meta">
                  <span className="application-label">Applied on</span>
                  <span className="application-value">{formatDate(application.createdAt)}</span>
                </div>
                <div className="application-meta">
                  <span className="application-label">Candidate ID</span>
                  <span className="application-value">{application.candidateId}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}