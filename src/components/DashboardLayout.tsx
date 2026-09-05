import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/context/AuthContext"
import { useGetSubscription } from "@/hooks/useBilling"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Users,
  Briefcase,
  Home,
  User,
  LogOut,
  Menu,
  X,
  CreditCard,
  Crown,
  Receipt,
} from "lucide-react"
import { Link, NavLink as RouterNavLink, useNavigate, Outlet, useLocation } from "react-router-dom"

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
  onClick,
}: {
  to: string
  label: string
  icon: any
  end?: boolean
  onClick?: () => void
}) {
  return (
    <RouterNavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center px-4 py-3 mx-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
          isActive
            ? "bg-[#3B2F8A]/10 text-[#3B2F8A]"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
        }`
      }
    >
      <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
      {label}
    </RouterNavLink>
  )
}

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const { data: subscription } = useGetSubscription()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isPro = subscription?.plan_tier === 'pro' || subscription?.plan_tier === 'enterprise'
  const planName = subscription?.plan_tier ? subscription.plan_tier.charAt(0).toUpperCase() + subscription.plan_tier.slice(1) : null

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [sidebarOpen])

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const navLinks = (
    <>
      <SidebarLink to="/dashboard" label="Dashboard" icon={Home} end onClick={closeSidebar} />
      <SidebarLink to="/dashboard/bids" label="Bids" icon={FileText} onClick={closeSidebar} />
      <SidebarLink to="/dashboard/subs" label="Subs" icon={Users} onClick={closeSidebar} />
      <SidebarLink to="/dashboard/jobs" label="Jobs" icon={Briefcase} onClick={closeSidebar} />
      <SidebarLink to="/dashboard/payments" label="Payments" icon={Receipt} onClick={closeSidebar} />
      <SidebarLink to="/dashboard/pricing" label="Pricing" icon={CreditCard} onClick={closeSidebar} />
      <SidebarLink to="/dashboard/profile" label="Profile" icon={User} onClick={closeSidebar} />
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-[#1e1b4b] text-white shadow-md sticky top-0 z-50">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger toggle - mobile only */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden flex items-center justify-center w-11 h-11 -ml-2 rounded-md text-white hover:bg-white/10 active:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            <Link
              to="/dashboard"
              className="text-xl sm:text-2xl font-bold tracking-tight text-white hover:text-gray-200 transition-colors"
            >
              TradePro
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {isPro && (
              <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 hidden sm:flex items-center gap-1">
                <Crown className="h-3 w-3" />
                {planName} Member
              </Badge>
            )}
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
              className="text-white hover:bg-white/10 hover:text-white min-h-[44px] min-w-[44px]"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Log Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Sidebar - overlay on mobile, static on desktop */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-64 bg-white border-r shadow-lg
            transform transition-transform duration-200 ease-in-out
            md:relative md:translate-x-0 md:shadow-sm md:z-auto
            overflow-y-auto
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
          role="navigation"
          aria-label="Main navigation"
        >
          {/* Mobile sidebar header */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b">
            <span className="text-lg font-semibold text-gray-900">Menu</span>
            <button
              onClick={closeSidebar}
              className="flex items-center justify-center w-11 h-11 rounded-md text-gray-500 hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile user info */}
          <div className="md:hidden px-4 py-3 border-b bg-gray-50">
            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className="text-xs capitalize"
              >
                {user.role}
              </Badge>
              {isPro && (
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 text-xs flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  {planName}
                </Badge>
              )}
            </div>
          </div>

          <nav className="py-4 md:py-6 space-y-1">
            {navLinks}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-white border-t px-4 sm:px-6 py-3">
        <p className="text-xs text-muted-foreground text-center">
          TradePro by Tremega
        </p>
      </footer>
    </div>
  )
}
