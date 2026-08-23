import { Link, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../lib/auth';

export default function DashboardLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg border-r border-gray-200">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-[#1A1A1A]">
            Tre<span className="text-[#3B2F8A]">mega</span>
          </h2>
        </div>
        <nav className="px-4 py-6 space-y-2">
          <Link
            to="/dashboard"
            className="block px-4 py-2 rounded-lg hover:bg-purple-50 text-gray-700 font-medium transition"
          >
            Dashboard
          </Link>
          <Link
            to="/dashboard/bids"
            className="block px-4 py-2 rounded-lg hover:bg-purple-50 text-gray-700 font-medium transition"
          >
            Bids
          </Link>
          <Link
            to="/dashboard/subs"
            className="block px-4 py-2 rounded-lg hover:bg-purple-50 text-gray-700 font-medium transition"
          >
            Subs
          </Link>
          <Link
            to="/dashboard/jobs"
            className="block px-4 py-2 rounded-lg hover:bg-purple-50 text-gray-700 font-medium transition"
          >
            Jobs
          </Link>
          <Link
            to="/dashboard/profile"
            className="block px-4 py-2 rounded-lg hover:bg-purple-50 text-gray-700 font-medium transition"
          >
            Profile
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-[#1A1A1A] text-white shadow-sm">
          <div className="px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              Tre<span className="text-[#3B2F8A]">mega</span>
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-[#3B2F8A] hover:bg-[#2f2570] rounded-lg text-sm font-medium transition"
            >
              Log Out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}