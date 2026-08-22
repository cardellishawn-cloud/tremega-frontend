import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Users, Briefcase, Home, Settings, User, LogOut } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <a
      href={to}
      className="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium"
    >
      {label}
    </a>
  );
}

export function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const stats = [
    { label: "Total Bids", value: "—", icon: FileText },
    { label: "Total Subs", value: "—", icon: Users },
    { label: "Pending Jobs", value: "—", icon: Briefcase },
  ]

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
          <nav className="mt-6">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} label={link.label} />
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Welcome, {user.full_name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="capitalize">
                  {user.role}
                </Badge>
                {user.company_name && (
                  <span className="text-muted-foreground text-sm">
                    {user.company_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <a href="/bids" className="block p-3 rounded-md hover:bg-accent transition-colors">
                  <div className="font-medium">View Bids</div>
                  <div className="text-sm text-muted-foreground">Manage your bids and estimates</div>
                </a>
                <a href="/subs" className="block p-3 rounded-md hover:bg-accent transition-colors">
                  <div className="font-medium">View Subs</div>
                  <div className="text-sm text-muted-foreground">Manage subcontractors</div>
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">No recent activity to display.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}