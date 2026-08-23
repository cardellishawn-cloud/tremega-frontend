import { ReactNode } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Support both patterns:
  // 1. <ProtectedRoute><DashboardLayout /></ProtectedRoute> (children)
  // 2. <Route element={<ProtectedRoute />}> with nested routes (Outlet)
  return children ? <>{children}</> : <Outlet />
}
