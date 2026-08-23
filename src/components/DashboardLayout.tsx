import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Users,
  Briefcase,
  Home,
  User,
  LogOut,
} from "lucide-react"
import { Link, NavLink as RouterNavLink, useNavigate, Outlet } from "react-router-dom"

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string
  label: string
  icon: any
  end?: boolean
}) {
  return (
    <RouterNavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? "bg-[#3B2F8A]/10 text-[#3B2F8A]"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`
      }
    >
      <Icon className="mr-3 h-4 w-4" />
      {label}
    </RouterNavLink>
  )
}

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-[#1e1b4b] text-white shadow-md sticky top-0 z-50">
        <div className="px-6 py-3 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="text-2xl font-bold tracking-tight text-white hover:text-gray-200 transition-colors"
          >
            Tremega
          </Link>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{user.full_name}</div>
              <Badge
                variant="secondary"
                className="text-xs capitalize bg-white/10 text-white border-white/20"
              >
                {user.role}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 bg-white border-r shadow-sm flex-shrink-0 overflow-y-auto">
          <nav className="py-6 space-y-1">
            <SidebarLink to="/dashboard" label="Dashboard" icon={Home} end />
            <SidebarLink to="/dashboard/bids" label="Bids" icon={FileText} />
            <SidebarLink to="/dashboard/subs" label="Subs" icon={Users} />
            <SidebarLink to="/dashboard/jobs" label="Jobs" icon={Briefcase} />
            <SidebarLink to="/dashboard/profile" label="Profile" icon={User} />
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
