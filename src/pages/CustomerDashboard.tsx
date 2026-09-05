import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useGetBids } from "@/hooks/useBids"
import { useGetJobs } from "@/hooks/useJobs"
import { useGetSubscription } from "@/hooks/useBilling"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  FileText, 
  Users, 
  Briefcase, 
  DollarSign, 
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Crown
} from "lucide-react"
import { Link } from "react-router-dom"

type DateRange = 'month' | '30days' | 'all'

export function CustomerDashboard() {
  const { user } = useAuth()
  const [dateRange, setDateRange] = useState<DateRange>('month')
  
  const { data: bids } = useGetBids()
  const { data: jobs } = useGetJobs()
  const { data: subscription } = useGetSubscription()

  if (!user) return null

  const isPro = subscription?.plan_tier === 'pro' || subscription?.plan_tier === 'enterprise'

  // Calculate date range filter
  const getDateFilter = () => {
    const now = new Date()
    switch (dateRange) {
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1)
      case '30days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      case 'all':
      default:
        return new Date(0)
    }
  }

  const filterDate = getDateFilter()

  // Filter data by date range
  const filteredBids = bids?.filter(b => new Date(b.created_at) >= filterDate) || []
  const filteredJobs = jobs?.filter(j => new Date(j.created_at) >= filterDate) || []

  // Calculate metrics
  const totalBids = filteredBids.length
  const activeJobs = filteredJobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress').length
  const completedJobs = filteredJobs.filter(j => j.status === 'completed').length
  const pendingBids = filteredBids.filter(b => b.status === 'draft' || b.status === 'sent').length

  // Calculate total spent (mock for now - would come from Stripe)
  const totalSpent = subscription?.plan_tier === 'pro' ? 99 : subscription?.plan_tier === 'enterprise' ? 199 : 0

  // Get next billing date
  const nextBillingDate = subscription?.current_period_end 
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  // Recent activity (mock data for now)
  const recentActivity = [
    ...filteredBids.slice(0, 5).map(b => ({
      id: b.id,
      type: 'bid' as const,
      title: `Bid "${b.title}" ${b.status}`,
      date: b.created_at,
      status: b.status,
    })),
    ...filteredJobs.slice(0, 5).map(j => ({
      id: j.id,
      type: 'job' as const,
      title: `Job "${j.title}" ${j.status}`,
      date: j.created_at,
      status: j.status,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

  const stats = [
    { 
      label: "Total Spent This Month", 
      value: `$${totalSpent}`, 
      icon: DollarSign,
      color: "text-green-600"
    },
    { 
      label: "Active Jobs", 
      value: activeJobs.toString(), 
      icon: Briefcase,
      color: "text-blue-600"
    },
    { 
      label: "Completed Jobs", 
      value: completedJobs.toString(), 
      icon: CheckCircle,
      color: "text-green-600"
    },
    { 
      label: "Pending Bids", 
      value: pendingBids.toString(), 
      icon: Clock,
      color: "text-yellow-600"
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Welcome, {user.full_name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="capitalize">
              {user.role}
            </Badge>
            {isPro && (
              <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 flex items-center gap-1">
                <Crown className="h-3 w-3" />
                {subscription?.plan_tier?.charAt(0).toUpperCase() + subscription?.plan_tier?.slice(1)} Member
              </Badge>
            )}
            {user.company_name && (
              <span className="text-muted-foreground text-sm">
                {user.company_name}
              </span>
            )}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex gap-2">
          <Button 
            variant={dateRange === 'month' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setDateRange('month')}
          >
            This Month
          </Button>
          <Button 
            variant={dateRange === '30days' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setDateRange('30days')}
          >
            Last 30 Days
          </Button>
          <Button 
            variant={dateRange === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setDateRange('all')}
          >
            All Time
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscription Info */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-lg capitalize">
                  {subscription.plan_tier || 'Free'} Plan
                </div>
                <Badge className={subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {subscription.status}
                </Badge>
              </div>
              {nextBillingDate && (
                <div className="text-sm text-muted-foreground">
                  Next billing date: <span className="font-medium">{nextBillingDate}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/dashboard/bids" className="block p-4 rounded-md hover:bg-accent active:bg-accent/80 transition-colors">
              <div className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                View Bids
              </div>
              <div className="text-sm text-muted-foreground">Manage your bids and estimates</div>
            </Link>
            <Link to="/dashboard/jobs" className="block p-4 rounded-md hover:bg-accent active:bg-accent/80 transition-colors">
              <div className="font-medium flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                View Jobs
              </div>
              <div className="text-sm text-muted-foreground">Track job progress</div>
            </Link>
            <Link to="/dashboard/subs" className="block p-4 rounded-md hover:bg-accent active:bg-accent/80 transition-colors">
              <div className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                View Subs
              </div>
              <div className="text-sm text-muted-foreground">Manage subcontractors</div>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      {activity.type === 'bid' ? (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{activity.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(activity.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {activity.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recent activity to display.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {pendingBids > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <div>
              <div className="font-medium text-yellow-800">
                You have {pendingBids} pending bid{pendingBids > 1 ? 's' : ''}
              </div>
              <div className="text-sm text-yellow-700">
                Review and send your bids to customers
              </div>
            </div>
            <Button size="sm" className="ml-auto" asChild>
              <Link to="/dashboard/bids">View Bids</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
