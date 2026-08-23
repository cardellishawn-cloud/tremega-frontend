import { useEffect, useState } from 'react';
import { getCurrentUser } from '../lib/auth';
import type { AuthUser } from '../lib/auth';

export default function Dashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchUser() {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#3B2F8A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1A1A1A] mb-2">Welcome to Tremega</h2>
      <p className="text-gray-500 mb-8">Your contractor management dashboard</p>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {user && (
        <div className="bg-gray-50 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#1A1A1A]">Your Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-[#1A1A1A] font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Full Name</p>
              <p className="text-[#1A1A1A] font-medium">{user.full_name || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Subscription</p>
              <p className="text-[#1A1A1A] font-medium capitalize">{user.subscription_tier}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
                {user.subscription_status}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}