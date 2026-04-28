import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/axios';
import './EmployerDashboard.css';

const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 'Unknown amount';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const getStatusClassName = (status) => {
  const normalizedStatus = `${status || ''}`.toLowerCase();

  if (normalizedStatus.includes('fail') || normalizedStatus.includes('reject')) {
    return 'status-badge status-badge-error';
  }

  if (normalizedStatus.includes('draft') || normalizedStatus.includes('pending')) {
    return 'status-badge status-badge-warning';
  }

  if (normalizedStatus.includes('publish') || normalizedStatus.includes('success')) {
    return 'status-badge status-badge-success';
  }

  return 'status-badge status-badge-neutral';
};

export function EmployerDashboard({ userProfile }) {
  const employerId = userProfile?.id;
  const [jobs, setJobs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jobsError, setJobsError] = useState(null);
  const [paymentsError, setPaymentsError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadEmployerHistory = async () => {
    if (!employerId) {
      setJobs([]);
      setPayments([]);
      return;
    }

    setLoading(true);
    setJobsError(null);
    setPaymentsError(null);

    try {
      const [jobsResult, paymentsResult] = await Promise.allSettled([
        api.get(`/api/v1/jobs/employer/${employerId}`),
        api.get(`/api/v1/payments/employer/${employerId}`),
      ]);

      if (jobsResult.status === 'fulfilled') {
        setJobs(Array.isArray(jobsResult.value.data) ? jobsResult.value.data : []);
      } else {
        setJobs([]);
        setJobsError('Unable to load your job history right now.');
        console.error('Failed to fetch employer jobs:', jobsResult.reason);
      }

      if (paymentsResult.status === 'fulfilled') {
        setPayments(Array.isArray(paymentsResult.value.data) ? paymentsResult.value.data : []);
      } else {
        setPayments([]);
        setPaymentsError('Unable to load your payment history right now.');
        console.error('Failed to fetch employer payments:', paymentsResult.reason);
      }

      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployerHistory();
  }, [employerId]);

  const summary = useMemo(() => {
    const publishedJobs = jobs.filter((job) => `${job.status || ''}`.toUpperCase() === 'PUBLISHED').length;
    const draftJobs = jobs.filter((job) => `${job.status || ''}`.toUpperCase() === 'DRAFT').length;
    const successfulPayments = payments.filter((payment) => `${payment.status || ''}`.toUpperCase() === 'SUCCESS');
    const failedPayments = payments.filter((payment) => `${payment.status || ''}`.toUpperCase() === 'FAILED').length;
    const totalRevenue = successfulPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    return {
      publishedJobs,
      draftJobs,
      successfulPayments: successfulPayments.length,
      failedPayments,
      totalRevenue,
    };
  }, [jobs, payments]);

  if (!employerId) {
    return (
      <div className="employer-dashboard-page">
        <div className="dashboard-shell dashboard-empty-state">
          <h1>Employer Dashboard</h1>
          <p>We need your employer profile before we can load job and payment history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employer-dashboard-page">
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <div className="dashboard-eyebrow">Employer history</div>
            <h1>Employer Dashboard</h1>
            <p>Review every job you created and every payment processed for this account.</p>
          </div>

          <div className="dashboard-actions">
            <div className="dashboard-meta">
              <span className="dashboard-meta-label">Employer ID</span>
              <span className="dashboard-meta-value">{employerId}</span>
            </div>
            <button className="dashboard-refresh-btn" onClick={loadEmployerHistory} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </header>

        {lastUpdated && (
          <div className="dashboard-updated">Last updated {lastUpdated.toLocaleTimeString()}</div>
        )}

        <section className="dashboard-summary">
          <article className="summary-card">
            <span className="summary-label">Jobs created</span>
            <strong className="summary-value">{jobs.length}</strong>
            <span className="summary-caption">{summary.publishedJobs} published, {summary.draftJobs} draft</span>
          </article>
          <article className="summary-card">
            <span className="summary-label">Payments processed</span>
            <strong className="summary-value">{payments.length}</strong>
            <span className="summary-caption">{summary.successfulPayments} successful, {summary.failedPayments} failed</span>
          </article>
          <article className="summary-card highlight-card">
            <span className="summary-label">Successful revenue</span>
            <strong className="summary-value">{formatCurrency(summary.totalRevenue)}</strong>
            <span className="summary-caption">Based on successful charge records</span>
          </article>
        </section>

        {(jobsError || paymentsError) && (
          <div className="dashboard-error-banner">
            {jobsError && <p>{jobsError}</p>}
            {paymentsError && <p>{paymentsError}</p>}
          </div>
        )}

        <div className="dashboard-grid">
          <section className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Your Jobs</h2>
                <p>Jobs created from this employer account.</p>
              </div>
              <span className="panel-count">{jobs.length} total</span>
            </div>

            {loading && jobs.length === 0 ? (
              <div className="panel-empty">Loading your job history...</div>
            ) : jobs.length === 0 ? (
              <div className="panel-empty">No jobs found for this employer account.</div>
            ) : (
              <div className="history-list">
                {jobs.map((job) => (
                  <article key={job.id} className="history-card">
                    <div className="history-card-top">
                      <div>
                        <h3>{job.title}</h3>
                        <p>{job.company || 'Company not provided'}</p>
                      </div>
                      <span className={getStatusClassName(job.status)}>{job.status || 'UNKNOWN'}</span>
                    </div>

                    <div className="history-details">
                      <div>
                        <span className="history-label">Salary range</span>
                        <span className="history-value">
                          {job.salary_min || job.salary_max
                            ? `${formatCurrency(job.salary_min)} - ${formatCurrency(job.salary_max)}`
                            : 'Not set'}
                        </span>
                      </div>
                      <div>
                        <span className="history-label">Job ID</span>
                        <span className="history-value">{job.id}</span>
                      </div>
                      <div>
                        <span className="history-label">Created</span>
                        <span className="history-value">{formatDate(job.created_at || job.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Payment History</h2>
                <p>Charges recorded for employer job postings.</p>
              </div>
              <span className="panel-count">{payments.length} total</span>
            </div>

            {loading && payments.length === 0 ? (
              <div className="panel-empty">Loading your payment history...</div>
            ) : payments.length === 0 ? (
              <div className="panel-empty">No payments recorded for this employer account.</div>
            ) : (
              <div className="history-list">
                {payments.map((payment) => (
                  <article key={payment.id} className="history-card payment-card">
                    <div className="history-card-top">
                      <div>
                        <h3>{formatCurrency(payment.amount)}</h3>
                        <p>Job ID: {payment.job_id}</p>
                      </div>
                      <span className={getStatusClassName(payment.status)}>{payment.status || 'UNKNOWN'}</span>
                    </div>

                    <div className="history-details">
                      <div>
                        <span className="history-label">Payment ID</span>
                        <span className="history-value">{payment.id}</span>
                      </div>
                      <div>
                        <span className="history-label">Processed</span>
                        <span className="history-value">{formatDate(payment.created_at || payment.createdAt)}</span>
                      </div>
                      <div>
                        <span className="history-label">Employer ID</span>
                        <span className="history-value">{payment.employer_id}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}