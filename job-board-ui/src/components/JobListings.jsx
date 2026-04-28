import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/axios';
import './JobListings.css';

export function JobListings({ onSelectJob }) {
  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    location: '',
    jobType: ''
  });
  const [page, setPage] = useState(1);
  const [searchSource, setSearchSource] = useState(null);
  const [searchDurationMs, setSearchDurationMs] = useState(null);

  const itemsPerPage = 10;
  const searchQuery = filters.search.trim();

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobs(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchJobs = async (query) => {
    setLoading(true);
    setError(null);
    try {
      const response = query
        ? await api.get('/api/v1/jobs/search', { params: { q: query } })
        : await api.get('/api/v1/jobs');

      const payload = response.data;
      const fetchedJobs = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      setAllJobs(fetchedJobs);
      setSearchSource(query ? payload?.source || 'database' : null);
      setSearchDurationMs(query ? payload?.duration_ms ?? null : null);
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
    if (name === 'search') {
      setPage(1);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [filters.location, filters.jobType]);

  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      const matchesLocation = !filters.location ||
        `${job.location || 'Remote'}`.toLowerCase().includes(filters.location.toLowerCase());

      const matchesType = !filters.jobType ||
        `${job.type || 'full-time'}`.toLowerCase() === filters.jobType.toLowerCase();

      return matchesLocation && matchesType;
    });
  }, [allJobs, filters.location, filters.jobType]);

  const totalPages = Math.max(Math.ceil(filteredJobs.length / itemsPerPage), 1);
  const paginatedJobs = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredJobs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredJobs, page]);

  const activeFiltersCount = [searchQuery, filters.location, filters.jobType].filter(Boolean).length;

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <h1>Available Positions</h1>
        <p className="jobs-count">
          {filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'} found
          {activeFiltersCount > 0 && ' with current filters'}
        </p>
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

      {searchQuery && (
        <div className="search-source-banner">
          <span>
            Search results loaded from {searchSource === 'cache' ? 'Redis cache' : 'database'}
            {typeof searchDurationMs === 'number' && ` in ${searchDurationMs.toFixed(2)} ms`}
          </span>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading jobs...</div>
      ) : paginatedJobs.length === 0 ? (
        <div className="no-jobs">
          <p>No jobs found matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="jobs-list">
            {paginatedJobs.map(job => (
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
                    Posted {new Date(job.created_at || job.createdAt).toLocaleDateString()}
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

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={page === 1} 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="btn-pagination"
              >
                Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button 
                disabled={page >= totalPages} 
                onClick={() => setPage(p => p + 1)}
                className="btn-pagination"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
