import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/context/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { DashboardLayout } from "@/components/DashboardLayout"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { CustomerDashboard } from "@/pages/CustomerDashboard"
import { BidsPage } from "@/pages/BidsPage"
import { SubsPage } from "@/pages/SubsPage"
import { JobsPage } from "@/pages/JobsPage"
import { JobTracking } from "@/pages/JobTracking"
import { ProfilePage } from "@/pages/ProfilePage"
import { ContractorProfile } from "@/pages/ContractorProfile"
import { PaymentHistory } from "@/pages/PaymentHistory"
import { PricingPage } from "@/pages/PricingPage"
import { SubDashboard } from "@/pages/SubDashboard"
import { BidForm } from "@/components/BidForm"
import { BidPreview } from "@/components/BidPreview"
import { DailyReportForm } from "@/components/DailyReportForm"
import { PremiumDailyReportForm } from "@/components/PremiumDailyReportForm"
import { TimesheetTracker } from "@/components/TimesheetTracker"

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CustomerDashboard />} />
              <Route path="bids" element={<BidsPage />} />
              <Route path="bids/new" element={<BidForm />} />
              <Route path="bids/:id" element={<BidPreview />} />
              <Route path="bids/:id/edit" element={<BidForm />} />
              <Route path="subs" element={<SubsPage />} />
              <Route path="jobs" element={<JobTracking />} />
              <Route path="jobs/old" element={<JobsPage />} />
              <Route path="daily-report" element={<PremiumDailyReportForm />} />
              <Route path="daily-report/basic" element={<DailyReportForm />} />
              <Route path="timesheets" element={<TimesheetTracker />} />
              <Route path="pricing" element={<PricingPage />} />
              <Route path="profile" element={<ContractorProfile />} />
              <Route path="profile/old" element={<ProfilePage />} />
              <Route path="payments" element={<PaymentHistory />} />
              <Route path="sub-dashboard" element={<SubDashboard />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
