import { useGetSubPerformance } from "@/hooks/useSubs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CheckCircle, Clock, Briefcase } from "lucide-react"

interface SubPerformanceDashboardProps {
  subId: string
  businessId: string
}

export function SubPerformanceDashboard({ subId, businessId }: SubPerformanceDashboardProps) {
  const { data, isLoading, error } = useGetSubPerformance(subId, businessId)

  if (isLoading) {
    return <div className="py-4 text-center text-muted-foreground">Loading performance data...</div>
  }

  if (error || !data) {
    return <div className="py-4 text-center text-destructive">Error loading performance data</div>
  }

  const { performance, recentAssignments } = data

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performance.completion_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {performance.completed_on_time} of {performance.total_assignments} on time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Turnaround</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performance.avg_turnaround_hours.toFixed(1)} hrs
            </div>
            <p className="text-xs text-muted-foreground">
              Average completion time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performance.total_assignments}
            </div>
            <p className="text-xs text-muted-foreground">
              Assignments completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Completed Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Completed Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAssignments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No completed jobs yet
            </div>
          ) : (
            <div className="space-y-4">
              {recentAssignments.map((assignment) => (
                <div 
                  key={assignment.id} 
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{assignment.bid_line_items.description}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {assignment.bid_line_items.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(assignment.bid_line_items.total)}</p>
                    <p className="text-sm text-muted-foreground">
                      Completed {formatDate(assignment.completed_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
