import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './pages/AuthLayout';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import DashboardLayout from './components/DashboardLayout';
import BidsPage from './pages/BidsPage';
import SubsPage from './pages/SubsPage';
import JobsPage from './pages/JobsPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Auth pages with shared layout */}
      <Route element={<AuthLayout />}>
        <Route path="/" element={<Login />} />
        <Route path="/sign-up" element={<SignUp />} />
      </Route>

      {/* Protected routes with DashboardLayout */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="bids" element={<BidsPage />} />
          <Route path="subs" element={<SubsPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Catch all — redirect to login */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

export default App;
