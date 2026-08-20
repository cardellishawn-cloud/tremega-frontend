import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Tre<span className="text-[#3B2F8A]">mega</span>
        </h1>
        <p className="text-gray-400 mt-2 text-sm">Contractor Management Platform</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <Outlet />
      </div>

      {/* Footer */}
      <p className="mt-8 text-gray-500 text-xs">
        &copy; {new Date().getFullYear()} Tremega. All rights reserved.
      </p>
    </div>
  );
}
