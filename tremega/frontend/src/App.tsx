import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { BidsPage } from "@/pages/BidsPage"
import { SubsPage } from "@/pages/SubsPage"
import { SubDashboard } from "@/pages/SubDashboard"
import { BidForm } from "@/components/BidForm"
import { BidPreview } from "@/components/BidPreview"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Users, LayoutDashboard, LogOut, Home } from "lucide-react"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
    },
  },
})

function AppLayout() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  // Role-based nav links
  const getNavLinks = () => {
    if (!user) return []
    switch (user.role) {
      case "admin":
        return [
          { to: "/dashboard", label: "Dashboard", icon: Home },
          { to: "/bids", label: "Bids", icon: FileText },
          { to: "/subs", label: "Subs", icon: Users },
        ]
      case "contractor":
        return [
          { to: "/dashboard", label: "Dashboard", icon: Home },
          { to: "/bids", label: "Bids", icon: FileText },
          { to: "/subs", label: "Subs", icon: Users },
        ]
      case "sub":
        return [
          { to: "/dashboard", label: "Dashboard", icon: Home },
          { to: "/sub-dashboard", label: "My Assignments", icon: LayoutDashboard },
        ]
      case "client":
        return [
          { to: "/dashboard", label: "Dashboard", icon: Home },
          { to: "/bids", label: "My Bids", icon: FileText },
        ]
      default:
        return [
          { to: "/dashboard", label: "Dashboard", icon: Home },
          { to: "/bids", label: "Bids", icon: FileText },
        ]
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && (
        <header className="border-b">
          <div className="container mx-auto py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/dashboard" className="text-2xl font-bold text-[#3B2F8A]">
                Tremega
              </Link>
              <nav className="flex items-center gap-2">
                {getNavLinks().map((link) => (
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
              {user && (
                <>
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
                </>
              )}
            </div>
          </div>
        </header>
      )}
      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bids"
            element={
              <ProtectedRoute>
                <BidsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bids/new"
            element={
              <ProtectedRoute>
                <BidForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bids/:id"
            element={
              <ProtectedRoute>
                <BidPreview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bids/:id/edit"
            element={
              <ProtectedRoute>
                <BidForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subs"
            element={
              <ProtectedRoute>
                <SubsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sub-dashboard"
            element={
              <ProtectedRoute>
                <SubDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
