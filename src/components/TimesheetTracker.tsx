import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useGetTimesheets, useClockIn, useClockOut } from "@/hooks/useTimesheets"
import { useGetJobs } from "@/hooks/useJobs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Clock, 
  Play, 
  Square, 
  Users, 
  DollarSign,
  Calendar,
  CheckCircle
} from "lucide-react"

export function TimesheetTracker() {
  const { user } = useAuth()
  const { data: jobs } = useGetJobs()
  const [selectedJob, setSelectedJob] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  const { data: timesheets, refetch } = useGetTimesheets(selectedJob, selectedDate)
  const clockIn = useClockIn()
  const clockOut = useClockOut()

  const [crewName, setCrewName] = useState("")
  const [crewRole, setCrewRole] = useState("")
  const [laborRate, setLaborRate] = useState("")

  if (!user) return null

  const activeJobs = jobs?.filter(j => j.status === 'scheduled' || j.status === 'in_progress') || []
  const activeTimesheets = timesheets?.filter(t => !t.clock_out) || []
  const completedTimesheets = timesheets?.filter(t => t.clock_out) || []

  const totalHours = completedTimesheets.reduce((sum, t) => sum + (t.total_hours || 0), 0)
  const totalCost = completedTimesheets.reduce((sum, t) => sum + (t.labor_cost || 0), 0)

  const handleClockIn = async () => {
    if (!selectedJob || !crewName) {
      alert("Please select a job and enter crew name")
      return
    }

    try {
      await clockIn.mutateAsync({
        job_id: selectedJob,
        crew_id: user.id,
        crew_name: crewName,
        crew_role: crewRole,
        labor_rate: laborRate ? parseFloat(laborRate) : undefined,
      })
      setCrewName("")
      setCrewRole("")
      setLaborRate("")
      refetch()
    } catch (error) {
      console.error("Failed to clock in:", error)
      alert("Failed to clock in")
    }
  }

  const handleClockOut = async (timesheetId: string) => {
    try {
      await clockOut.mutateAsync({
        id: timesheetId,
        tasks_completed: [],
      })
      refetch()
    } catch (error) {
      console.error("Failed to clock out:", error)
      alert("Failed to clock out")
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Timesheet Tracker</h1>
          <p className="text-muted-foreground mt-1">
            Track crew hours and labor costs
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(selectedDate).toLocaleDateString()}
          </Badge>
        </div>
      </div>

      {/* Job & Date Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job">Select Job</Label>
              <select
                id="job"
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Choose a job...</option>
                {activeJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => refetch()} className="w-full">
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedJob && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{activeTimesheets.length}</div>
                  <div className="text-sm text-muted-foreground">Active Crew</div>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Total Hours</div>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">Labor Cost</div>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Clock In Form */}
      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Clock In Crew Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="crewName">Crew Name *</Label>
                <Input
                  id="crewName"
                  value={crewName}
                  onChange={(e) => setCrewName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crewRole">Role</Label>
                <Input
                  id="crewRole"
                  value={crewRole}
                  onChange={(e) => setCrewRole(e.target.value)}
                  placeholder="Foreman"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="laborRate">Hourly Rate ($)</Label>
                <Input
                  id="laborRate"
                  type="number"
                  value={laborRate}
                  onChange={(e) => setLaborRate(e.target.value)}
                  placeholder="35.00"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleClockIn} 
                  className="w-full"
                  disabled={clockIn.isPending}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Clock In
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Timesheets */}
      {activeTimesheets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Active Crew ({activeTimesheets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeTimesheets.map((timesheet) => (
                <div
                  key={timesheet.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium">{timesheet.crew_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {timesheet.crew_role} • Clocked in at {formatTime(timesheet.clock_in)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="bg-green-50">
                      Active
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleClockOut(timesheet.id)}
                      disabled={clockOut.isPending}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Clock Out
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Timesheets */}
      {completedTimesheets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Completed Shifts ({completedTimesheets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {completedTimesheets.map((timesheet) => (
                <div
                  key={timesheet.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium">{timesheet.crew_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatTime(timesheet.clock_in)} - {timesheet.clock_out ? formatTime(timesheet.clock_out) : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium">{timesheet.total_hours?.toFixed(1)} hrs</div>
                      <div className="text-sm text-muted-foreground">
                        ${timesheet.labor_cost?.toFixed(2)}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      Completed
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {selectedJob && timesheets?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No timesheets for this date</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clock in crew members to start tracking time
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
