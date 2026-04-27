import './JobDetail.css';

export function JobDetail({ job, onBack, onApply }) {
  if (!job) return null;

  const handleApplyClick = () => {
    onApply(job);
  };

  return (
    <div className="job-detail-container">
      <button className="btn-back" onClick={onBack}>
        ← Back to Listings
      </button>

      <div className="job-detail-card">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{job.title}</h1>
            <p className="detail-company">{job.company}</p>
          </div>
          <button className="btn btn-primary btn-apply" onClick={handleApplyClick}>
            Apply Now
          </button>
        </div>

        <div className="detail-meta">
          <div className="meta-item">
            <span className="label">Location:</span>
            <span className="value">📍 {job.location || 'Remote'}</span>
          </div>
          <div className="meta-item">
            <span className="label">Job Type:</span>
            <span className="value">{job.type || 'Full Time'}</span>
          </div>
          {job.salary && (
            <div className="meta-item">
              <span className="label">Salary:</span>
              <span className="value">💰 {job.salary}</span>
            </div>
          )}
          <div className="meta-item">
            <span className="label">Posted:</span>
            <span className="value">{new Date(job.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="detail-section">
          <h2>About the Role</h2>
          <p>{job.description}</p>
        </div>

        {job.requirements && (
          <div className="detail-section">
            <h2>Requirements</h2>
            <div className="requirements-list">
              {typeof job.requirements === 'string' ? (
                <p>{job.requirements}</p>
              ) : Array.isArray(job.requirements) ? (
                <ul>
                  {job.requirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )}

        {job.benefits && (
          <div className="detail-section">
            <h2>Benefits</h2>
            <div className="benefits-list">
              {typeof job.benefits === 'string' ? (
                <p>{job.benefits}</p>
              ) : Array.isArray(job.benefits) ? (
                <ul>
                  {job.benefits.map((benefit, idx) => (
                    <li key={idx}>{benefit}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )}

        <div className="detail-footer">
          <button className="btn btn-primary btn-apply-large" onClick={handleApplyClick}>
            Apply for {job.title}
          </button>
        </div>
      </div>
    </div>
  );
}
