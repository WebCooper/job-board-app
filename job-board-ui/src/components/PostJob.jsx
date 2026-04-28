import { useState } from 'react';
import { api } from '../api/axios';
import './PostJob.css';

export function PostJob({ userProfile, onSuccess }) {
  const [step, setStep] = useState(1); // Step 1: Job Details, Step 2: Payment Details, Step 3: Review
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    salaryMin: '',
    salaryMax: '',
    jobType: 'full-time',
    company: '',
    employerEmail: '',
    requirements: ''
  });
  
  const POSTING_FEE = 10.00; // Hardcoded $10 posting fee

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [sagaStatus, setSagaStatus] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.title.trim()) {
        setError('Job title is required');
        return false;
      }
      if (!formData.description.trim()) {
        setError('Job description is required');
        return false;
      }
      if (!formData.location.trim()) {
        setError('Location is required');
        return false;
      }
      if (!formData.company.trim()) {
        setError('Company name is required');
        return false;
      }
      if (!formData.employerEmail.trim()) {
        setError('Employer email is required');
        return false;
      }
      if (!/^\S+@\S+\.\S+$/.test(formData.employerEmail.trim())) {
        setError('Employer email must be a valid email address');
        return false;
      }
      if (!formData.salaryMin || !formData.salaryMax) {
        setError('Salary range is required');
        return false;
      }
      const minSal = parseInt(formData.salaryMin);
      const maxSal = parseInt(formData.salaryMax);
      if (minSal > maxSal) {
        setError('Minimum salary cannot be greater than maximum salary');
        return false;
      }
      if (maxSal > 99999999) {
        setError('Maximum salary exceeds allowed limit');
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleNextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handlePreviousStep = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSagaStatus(null);

    try {
      // Call the Saga Orchestrator endpoint (charge is hardcoded to $10 on backend)
      const response = await api.post('/api/v1/application/post-job', {
        employer_id: userProfile.id,
        employer_email: formData.employerEmail.trim(),
        job_details: {
          title: formData.title,
          description: formData.description,
          location: formData.location,
          salary_min: parseInt(formData.salaryMin),
          salary_max: parseInt(formData.salaryMax),
          job_type: formData.jobType,
          company: formData.company,
          employer_email: formData.employerEmail.trim(),
          employerEmail: formData.employerEmail.trim(),
          requirements: formData.requirements
        }
      });

      setSagaStatus(response.data.saga_status);
      setSuccess(true);
      onSuccess?.();

      // Reset form after 3 seconds
      setTimeout(() => {
        setStep(1);
        setFormData({
          title: '',
          description: '',
          location: '',
          salaryMin: '',
          salaryMax: '',
          jobType: 'full-time',
          company: '',
          employerEmail: '',
          requirements: ''
        });
      }, 3000);
    } catch (err) {
      console.error('Job posting failed:', err);
      const errorData = err.response?.data;
      if (errorData?.error === 'PAYMENT_FAILED') {
        setError('Payment failed: ' + (errorData.message || 'Card declined. Draft job has been removed.'));
        setSagaStatus(errorData.saga_status);
      } else if (errorData?.error === 'SAGA_FAILED') {
        setError('System error during job posting: ' + (errorData.details || 'Please try again later.'));
        setSagaStatus('FAILED');
      } else {
        setError(errorData?.message || 'Failed to post job. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="post-job-container">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h2>Job Posted Successfully!</h2>
          <p>Your job listing has been published and is now visible to candidates.</p>
          {sagaStatus && (
            <p className="saga-status">Saga Status: <strong>{sagaStatus}</strong></p>
          )}
          <p className="notification-message">
            An email confirmation has been sent to your registered email address.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="post-job-container">
      <div className="post-job-card">
        <h1>Post a New Job</h1>
        <div className="step-indicator">
          <div className={`step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
            <span>1</span>
            <p>Job Details</p>
          </div>
          <div className={`step-line ${step > 1 ? 'completed' : ''}`}></div>
          <div className={`step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
            <span>2</span>
            <p>Posting Fee</p>
          </div>
          <div className={`step-line ${step > 2 ? 'completed' : ''}`}></div>
          <div className={`step ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
            <span>3</span>
            <p>Review</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Job Details */}
          {step === 1 && (
            <div className="form-step">
              <h2>Tell us about the job</h2>

              <div className="form-group">
                <label>Job Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Senior Software Engineer"
                  maxLength="100"
                />
              </div>

              <div className="form-group">
                <label>Company Name *</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Your company name"
                  maxLength="100"
                />
              </div>

              <div className="form-group">
                <label>Employer Email *</label>
                <input
                  type="email"
                  name="employerEmail"
                  value={formData.employerEmail}
                  onChange={handleInputChange}
                  placeholder="employer@example.com"
                  maxLength="254"
                />
              </div>

              <div className="form-group">
                <label>Location *</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g., San Francisco, CA or Remote"
                  maxLength="100"
                />
              </div>

              <div className="form-group">
                <label>Job Type *</label>
                <select
                  name="jobType"
                  value={formData.jobType}
                  onChange={handleInputChange}
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>

              <div className="salary-group">
                <div className="form-group">
                  <label>Minimum Salary (Annual) *</label>
                  <input
                    type="number"
                    name="salaryMin"
                    value={formData.salaryMin}
                    onChange={handleInputChange}
                    placeholder="50000"
                    min="0"
                    max="99999999"
                  />
                </div>
                <div className="form-group">
                  <label>Maximum Salary (Annual) *</label>
                  <input
                    type="number"
                    name="salaryMax"
                    value={formData.salaryMax}
                    onChange={handleInputChange}
                    placeholder="100000"
                    min="0"
                    max="99999999"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Job Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Provide a detailed description of the job, responsibilities, and ideal candidate profile..."
                  rows={8}
                  maxLength="2000"
                />
              </div>

              <div className="form-group">
                <label>Requirements (Optional)</label>
                <textarea
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleInputChange}
                  placeholder="List specific requirements, qualifications, skills, and experience needed..."
                  rows={6}
                  maxLength="2000"
                />
              </div>
            </div>
          )}

          {/* Step 2: Payment Details */}
          {step === 2 && (
            <div className="form-step">
              <h2>Posting Fee</h2>
              <p className="step-description">
                A posting fee is required to publish your job listing on our platform. Your job will remain live for 30 days.
              </p>

              <div className="payment-info">
                <div className="info-item">
                  <span className="label">Job Title:</span>
                  <span className="value">{formData.title}</span>
                </div>
                <div className="info-item">
                  <span className="label">Company:</span>
                  <span className="value">{formData.company}</span>
                </div>
                <div className="info-item">
                  <span className="label">Location:</span>
                  <span className="value">{formData.location}</span>
                </div>
              </div>

              <div className="form-group">
                <label>Posting Fee (USD)</label>
                <div className="fee-input-wrapper">
                  <span className="currency">$</span>
                  <input
                    type="text"
                    value={POSTING_FEE.toFixed(2)}
                    disabled
                    readOnly
                  />
                </div>
                <small>Fixed fee for all job postings</small>
              </div>

              <div className="payment-warning">
                <p>
                  <strong>Note:</strong> Your card will be charged ${POSTING_FEE.toFixed(2)} to publish this job listing.
                  If payment fails, the job will not be created. Payment processing is secure and encrypted.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="form-step">
              <h2>Review Your Job Posting</h2>

              <div className="review-section">
                <h3>Job Details</h3>
                <div className="review-item">
                  <span className="label">Title:</span>
                  <span className="value">{formData.title}</span>
                </div>
                <div className="review-item">
                  <span className="label">Company:</span>
                  <span className="value">{formData.company}</span>
                </div>
                <div className="review-item">
                  <span className="label">Employer Email:</span>
                  <span className="value">{formData.employerEmail}</span>
                </div>
                <div className="review-item">
                  <span className="label">Location:</span>
                  <span className="value">{formData.location}</span>
                </div>
                <div className="review-item">
                  <span className="label">Job Type:</span>
                  <span className="value">{formData.jobType.charAt(0).toUpperCase() + formData.jobType.slice(1)}</span>
                </div>
                <div className="review-item">
                  <span className="label">Salary Range:</span>
                  <span className="value">${parseInt(formData.salaryMin).toLocaleString()} - ${parseInt(formData.salaryMax).toLocaleString()}</span>
                </div>
                <div className="review-item">
                  <span className="label">Description:</span>
                  <span className="value description">{formData.description}</span>
                </div>
                {formData.requirements && (
                  <div className="review-item">
                    <span className="label">Requirements:</span>
                    <span className="value description">{formData.requirements}</span>
                  </div>
                )}
              </div>

              <div className="review-section payment">
                <h3>Payment Details</h3>
                <div className="review-item">
                  <span className="label">Posting Fee:</span>
                  <span className="value amount">${POSTING_FEE.toFixed(2)}</span>
                </div>
                <p className="payment-notice">
                  By clicking "Publish & Pay", you authorize the payment and your job will be published immediately upon successful payment.
                </p>
              </div>
            </div>
          )}

          <div className="form-actions">
            {step > 1 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePreviousStep}
                disabled={loading}
              >
                Previous
              </button>
            )}

            {step < 3 && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleNextStep}
                disabled={loading}
              >
                Next
              </button>
            )}

            {step === 3 && (
              <button
                type="submit"
                className="btn-primary btn-publish"
                disabled={loading}
              >
                {loading ? 'Publishing & Processing Payment...' : 'Publish & Pay'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
