import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Users, Briefcase, Home, Settings, User, LogOut } from "lucide-react"
import { Link, useNavigate, Outlet } from "react-router-dom"

function NavLink({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  return (
    <Link
      to={to}
      className="flex items-center px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium transition-colors"
    >
      <Icon className="mr-3 h-4 w-4" />
      {label}
    </Link>
  );
}

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const navLinks = [
    { to: "/dashboard", label: "Dashboard", icon: Home },
    { to: "/bids", label: "Bids", icon: FileText },
    { to: "/subs", label: "Subs", icon: Users },
    { to: "/jobs", label: "Jobs", icon: Briefcase },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/profile", label: "Profile", icon: User },
    { to: "/settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-2xl font-bold text-[#3B2F8A]">
              Tremega
            </Link>
            <nav className="hidden md:flex items-center gap-2">
              {navLinks.slice(0, 3).map((link) => (
                <Link key={link.to} to={link.to}>
                  <Button variant="ghost" size="sm">
                    <link.icon className="mr-2 h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium">{user.full_name}</div>
              <Badge variant="secondary" className="text-xs capitalize">
                {user.role}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg min-h-screen">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800">Navigation</h2>
          </div>
          <nav className="mt-6 space-y-1">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} label={link.label} icon={link.icon} />
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}