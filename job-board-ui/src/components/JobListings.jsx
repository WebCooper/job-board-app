import { useEffect, useState } from 'react';
import { api } from '../api/axios';
import './JobListings.css';

export function JobListings({ onSelectJob, userProfile }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    location: '',
    jobType: ''
  });

  useEffect(() => {
    fetchJobs();
  }, [filters]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch published jobs from the API
      const response = await api.get('/api/v1/jobs');
      const allJobs = response.data || [];
      
      // Filter jobs based on user inputs
      let filtered = allJobs.filter(job => {
        const matchesSearch = !filters.search || 
          job.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
          job.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
          job.company?.toLowerCase().includes(filters.search.toLowerCase());
        
        const matchesLocation = !filters.location || 
          job.location?.toLowerCase().includes(filters.location.toLowerCase());
        
        const matchesType = !filters.jobType || 
          job.type?.toLowerCase() === filters.jobType.toLowerCase();
        
        return matchesSearch && matchesLocation && matchesType;
      });

      setJobs(filtered);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setError('Failed to load job listings. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <div className="loading">Loading jobs...</div>;
  }

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <h1>Available Positions</h1>
        <p className="jobs-count">{jobs.length} jobs found</p>
      </div>

      <div className="filters-section">
        <input
          type="text"
          name="search"
          placeholder="Search by title, company, or keywords..."
          value={filters.search}
          onChange={handleFilterChange}
          className="filter-input"
        />
        <input
          type="text"
          name="location"
          placeholder="Filter by location..."
          value={filters.location}
          onChange={handleFilterChange}
          className="filter-input"
        />
        <select
          name="jobType"
          value={filters.jobType}
          onChange={handleFilterChange}
          className="filter-input"
        >
          <option value="">All Job Types</option>
          <option value="full-time">Full Time</option>
          <option value="part-time">Part Time</option>
          <option value="contract">Contract</option>
          <option value="remote">Remote</option>
        </select>
      </div>

      {error && <div className="error-message">{error}</div>}

      {jobs.length === 0 ? (
        <div className="no-jobs">
          <p>No jobs found matching your criteria.</p>
        </div>
      ) : (
        <div className="jobs-list">
          {jobs.map(job => (
            <div
              key={job.id}
              className="job-card"
              onClick={() => onSelectJob(job)}
            >
              <div className="job-header">
                <h3 className="job-title">{job.title}</h3>
                <span className="job-type">{job.type || 'Full Time'}</span>
              </div>
              
              <p className="job-company">{job.company}</p>
              
              <div className="job-meta">
                <span className="job-location">📍 {job.location || 'Remote'}</span>
                {job.salary && (
                  <span className="job-salary">💰 {job.salary}</span>
                )}
              </div>

              <p className="job-description">
                {job.description?.substring(0, 150)}...
              </p>

              <div className="job-footer">
                <span className="job-date">
                  Posted {new Date(job.createdAt).toLocaleDateString()}
                </span>
                <button className="btn-view" onClick={(e) => {
                  e.stopPropagation();
                  onSelectJob(job);
                }}>
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
