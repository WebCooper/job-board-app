import { useState } from 'react';
import { api } from '../api/axios';
import './ApplicationForm.css';

export function ApplicationForm({ job, userProfile, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    resume: '',
    coverLetter: '',
    phoneNumber: '',
    preferredStartDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Submit application through the application service
      const response = await api.post('/api/v1/application/apply', {
        jobId: job.id,
        candidateId: userProfile.id,
        resume: formData.resume,
        coverLetter: formData.coverLetter,
        phoneNumber: formData.phoneNumber,
        preferredStartDate: formData.preferredStartDate
      });

      setSuccess(true);
      onSuccess?.();
      
      // Close form after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Application submission failed:', err);
      setError(err.response?.data?.message || 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="success-message">
            <h2>✓ Application Submitted!</h2>
            <p>Thank you for applying to {job.title} at {job.company}.</p>
            <p>We'll review your application and get back to you soon.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Apply for {job.title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="application-form">
          <div className="form-group">
            <label>Phone Number *</label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              required
              placeholder="Enter your phone number"
            />
          </div>

          <div className="form-group">
            <label>Resume / CV *</label>
            <textarea
              name="resume"
              value={formData.resume}
              onChange={handleInputChange}
              required
              placeholder="Paste your resume or attach it here..."
              rows={6}
            />
          </div>

          <div className="form-group">
            <label>Cover Letter</label>
            <textarea
              name="coverLetter"
              value={formData.coverLetter}
              onChange={handleInputChange}
              placeholder="Tell us why you're a great fit for this role..."
              rows={5}
            />
          </div>

          <div className="form-group">
            <label>Preferred Start Date</label>
            <input
              type="date"
              name="preferredStartDate"
              value={formData.preferredStartDate}
              onChange={handleInputChange}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
