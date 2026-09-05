import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useGetJobs } from "@/hooks/useJobs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Briefcase, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Calendar,
  User,
  MessageSquare,
  Eye
} from "lucide-react"
import { Link } from "react-router-dom"

type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export function JobTracking() {
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')
  
  const { data: jobs, isLoading } = useGetJobs()

  if (!user) return null

  // Filter jobs by status
  const filteredJobs = jobs?.filter(job => {
    if (statusFilter === 'all') return true
    return job.status === statusFilter
  }) || []

  // Group jobs by status for stats
  const jobStats = {
    scheduled: jobs?.filter(j => j.status === 'scheduled').length || 0,
    in_progress: jobs?.filter(j => j.status === 'in_progress').length || 0,
    completed: jobs?.filter(j => j.status === 'completed').length || 0,
    cancelled: jobs?.filter(j => j.status === 'cancelled').length || 0,
  }

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />
    }
  }

  const getStatusBadge = (status: JobStatus) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return <Badge className={colors[status]}>{status.replace('_', ' ')}</Badge>
  }

  const statusColumns: { status: JobStatus; label: string; color: string }[] = [
    { status: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800' },
    { status: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
    { status: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
    { status: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  ]

  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Job Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage all your jobs
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/jobs/new">
            <Briefcase className="mr-2 h-4 w-4" />
            New Job
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statusColumns.map((column) => (
          <Card 
            key={column.status}
            className={`cursor-pointer transition-all ${statusFilter === column.status ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter(statusFilter === column.status ? 'all' : column.status)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{jobStats[column.status]}</div>
                  <div className="text-sm text-muted-foreground">{column.label}</div>
                </div>
                {getStatusIcon(column.status)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          All Jobs
        </Button>
        {statusColumns.map((column) => (
          <Button
            key={column.status}
            variant={statusFilter === column.status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(column.status)}
          >
            {column.label}
          </Button>
        ))}
      </div>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {statusFilter === 'all' ? 'All Jobs' : statusColumns.find(c => c.status === statusFilter)?.label}
            <span className="ml-2 text-muted-foreground font-normal">({filteredJobs.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading jobs...</div>
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="space-y-4">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="font-medium">{job.title}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        Created {new Date(job.created_at).toLocaleDateString()}
                        {job.started_at && (
                          <>
                            <span>•</span>
                            Started {new Date(job.started_at).toLocaleDateString()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(job.status)}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/dashboard/jobs/${job.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Message
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No jobs found</p>
              <Button className="mt-4" asChild>
                <Link to="/dashboard/jobs/new">Create Your First Job</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Timeline (for selected job) */}
      {filteredJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Status Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center gap-4 pb-4 border-b last:border-0">
                  <div className="flex-shrink-0">
                    {getStatusIcon(job.status)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{job.title}</div>
                    <div className="text-sm text-muted-foreground">
                      Status changed to {job.status.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(job.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
