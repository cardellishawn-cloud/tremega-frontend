import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch jobs from backend on mount
  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const endpoint = user.role === 'contractor' 
        ? `${API_URL}/jobs/assigned/${user.id}` 
        : `${API_URL}/jobs`;
      const response = await fetch(endpoint);
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      // For demo purposes, set mock data if API fails
      if (user.role === 'contractor') {
        setJobs([
          {
            id: 1,
            title: 'Fix Kitchen Sink',
            customer: 'John Smith',
            address: '123 Main St, Anytown, USA',
            description: 'Kitchen sink is leaking and needs immediate repair',
            urgency: 'high',
            status: 'assigned',
            scheduledDate: '2026-08-02',
            assignedTo: user.id
          },
          {
            id: 2,
            title: 'Install Ceiling Fan',
            customer: 'Sarah Johnson',
            address: '456 Oak Ave, Anytown, USA',
            description: 'Install new ceiling fan in master bedroom',
            urgency: 'medium',
            status: 'assigned',
            scheduledDate: '2026-08-03',
            assignedTo: user.id
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('login');
    setJobs([]);
    setSelectedJob(null);
  };

  const handleJobSelect = (job) => {
    setSelectedJob(job);
    setCurrentPage('job-detail');
  };

  const handleBackToDashboard = () => {
    setSelectedJob(null);
    setCurrentPage('dashboard');
  };

  const updateJobStatus = async (jobId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        // Update local state
        setJobs(jobs.map(job => 
          job.id === jobId ? { ...job, status: newStatus } : job
        ));
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob({ ...selectedJob, status: newStatus });
        }
      }
    } catch (error) {
      console.error('Error updating job status:', error);
      // For demo, update locally anyway
      setJobs(jobs.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      ));
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob({ ...selectedJob, status: newStatus });
      }
    }
  };

  // Login Page Component
  const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('property-manager');

    const handleSubmit = (e) => {
      e.preventDefault();
      // Mock login - in real app, this would call the API
      if (email && password) {
        handleLogin({ 
          email, 
          name: role === 'contractor' ? 'Mike Contractor' : 'Jane Manager', 
          role: role,
          id: role === 'contractor' ? 'contractor-1' : 'manager-1'
        });
      }
    };

    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Handyman Dispatch</h1>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Role:</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                className="role-select"
              >
                <option value="property-manager">Property Manager</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary">Login</button>
          </form>
        </div>
      </div>
    );
  };

  // Property Manager Dashboard
  const PropertyManagerDashboard = () => (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Property Manager Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user?.name}</span>
          <button onClick={handleLogout} className="btn-secondary">Logout</button>
        </div>
      </header>
      
      <div className="dashboard-content">
        <div className="jobs-section">
          <h2>All Jobs</h2>
          {loading ? (
            <p>Loading jobs...</p>
          ) : jobs.length > 0 ? (
            <div className="jobs-grid">
              {jobs.map(job => (
                <div key={job.id} className="job-card" onClick={() => handleJobSelect(job)}>
                  <h3>{job.title}</h3>
                  <p><strong>Customer:</strong> {job.customer}</p>
                  <p><strong>Status:</strong> <span className={`status ${job.status}`}>{job.status}</span></p>
                  <p><strong>Urgency:</strong> <span className={`urgency ${job.urgency}`}>{job.urgency}</span></p>
                  <p><strong>Scheduled:</strong> {job.scheduledDate}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>No jobs available. Create your first job!</p>
          )}
        </div>
      </div>
    </div>
  );

  // Contractor Dashboard
  const ContractorDashboard = () => (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Contractor Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user?.name}</span>
          <button onClick={handleLogout} className="btn-secondary">Logout</button>
        </div>
      </header>
      
      <div className="dashboard-content">
        <div className="jobs-section">
          <h2>My Assigned Jobs</h2>
          {loading ? (
            <p>Loading jobs...</p>
          ) : jobs.length > 0 ? (
            <div className="jobs-grid">
              {jobs.map(job => (
                <div key={job.id} className="job-card contractor-card" onClick={() => handleJobSelect(job)}>
                  <h3>{job.title}</h3>
                  <p><strong>Address:</strong> {job.address}</p>
                  <p><strong>Status:</strong> <span className={`status ${job.status}`}>{job.status}</span></p>
                  <p><strong>Urgency:</strong> <span className={`urgency ${job.urgency}`}>{job.urgency}</span></p>
                  <p><strong>Scheduled:</strong> {job.scheduledDate}</p>
                  <div className="job-actions-preview">
                    {job.status === 'assigned' && (
                      <button 
                        className="btn-small btn-start"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateJobStatus(job.id, 'in-progress');
                        }}
                      >
                        Start Job
                      </button>
                    )}
                    {job.status === 'in-progress' && (
                      <button 
                        className="btn-small btn-complete"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateJobStatus(job.id, 'completed');
                        }}
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No jobs assigned to you yet.</p>
          )}
        </div>
      </div>
    </div>
  );

  // Job Detail Page Component
  const JobDetailPage = () => {
    const [photos, setPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);

    const handlePhotoUpload = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      setUploading(true);
      
      // Create preview URLs for immediate display
      const newPhotos = files.map(file => ({
        id: Date.now() + Math.random(),
        file,
        url: URL.createObjectURL(file),
        name: file.name
      }));
      
      setPhotos([...photos, ...newPhotos]);
      
      // In a real app, you would upload to the server here
      try {
        // const formData = new FormData();
        // files.forEach(file => formData.append('photos', file));
        // await fetch(`${API_URL}/jobs/${selectedJob.id}/photos`, {
        //   method: 'POST',
        //   body: formData
        // });
      } catch (error) {
        console.error('Error uploading photos:', error);
      } finally {
        setUploading(false);
      }
    };

    const removePhoto = (photoId) => {
      setPhotos(photos.filter(photo => photo.id !== photoId));
    };

    return (
      <div className="job-detail">
        <header className="job-detail-header">
          <button onClick={handleBackToDashboard} className="btn-back">← Back to Dashboard</button>
          <h1>Job Details</h1>
        </header>
        
        {selectedJob && (
          <div className="job-detail-content">
            <div className="job-info-card">
              <h2>{selectedJob.title}</h2>
              <div className="job-meta">
                <p><strong>Job ID:</strong> {selectedJob.id}</p>
                <p><strong>Customer:</strong> {selectedJob.customer}</p>
                <p><strong>Status:</strong> <span className={`status ${selectedJob.status}`}>{selectedJob.status}</span></p>
                <p><strong>Urgency:</strong> <span className={`urgency ${selectedJob.urgency}`}>{selectedJob.urgency}</span></p>
                <p><strong>Scheduled Date:</strong> {selectedJob.scheduledDate}</p>
                <p><strong>Address:</strong> {selectedJob.address}</p>
              </div>
              
              <div className="job-description">
                <h3>Description</h3>
                <p>{selectedJob.description}</p>
              </div>

              {/* Photo Upload Section - Only for Contractors */}
              {user.role === 'contractor' && (
                <div className="photo-section">
                  <h3>Job Photos</h3>
                  <div className="photo-upload">
                    <input
                      type="file"
                      id="photo-upload"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="photo-upload" className="btn-primary upload-btn">
                      {uploading ? 'Uploading...' : 'Upload Photos'}
                    </label>
                  </div>
                  
                  {photos.length > 0 && (
                    <div className="photo-gallery">
                      {photos.map(photo => (
                        <div key={photo.id} className="photo-item">
                          <img src={photo.url} alt={photo.name} />
                          <button 
                            className="remove-photo"
                            onClick={() => removePhoto(photo.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="job-actions">
                {user.role === 'contractor' ? (
                  <>
                    {selectedJob.status === 'assigned' && (
                      <button 
                        className="btn-primary"
                        onClick={() => updateJobStatus(selectedJob.id, 'in-progress')}
                      >
                        Start Job
                      </button>
                    )}
                    {selectedJob.status === 'in-progress' && (
                      <button 
                        className="btn-primary"
                        onClick={() => updateJobStatus(selectedJob.id, 'completed')}
                      >
                        Mark as Completed
                      </button>
                    )}
                    {selectedJob.status === 'completed' && (
                      <p className="completion-message">✅ Job Completed</p>
                    )}
                  </>
                ) : (
                  <>
                    <button className="btn-primary">Assign Contractor</button>
                    <button className="btn-secondary">Edit Job</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render current page
  return (
    <div className="App">
      {currentPage === 'login' && <LoginPage />}
      {currentPage === 'dashboard' && user?.role === 'property-manager' && <PropertyManagerDashboard />}
      {currentPage === 'dashboard' && user?.role === 'contractor' && <ContractorDashboard />}
      {currentPage === 'job-detail' && <JobDetailPage />}
    </div>
  );
}

export default App;