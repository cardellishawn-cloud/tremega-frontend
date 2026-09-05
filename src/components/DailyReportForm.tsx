import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useCreateDailyReport, useSubmitDailyReport } from "@/hooks/useDailyReports"
import { useGetJobs } from "@/hooks/useJobs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Calendar, 
  Clock, 
  Cloud, 
  Users, 
  Camera, 
  AlertTriangle,
  CheckCircle,
  Save,
  Send
} from "lucide-react"

export function DailyReportForm() {
  const { user } = useAuth()
  const { data: jobs } = useGetJobs()
  const createReport = useCreateDailyReport()
  const submitReport = useSubmitDailyReport()

  const [selectedJob, setSelectedJob] = useState("")
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState("07:00")
  const [endTime, setEndTime] = useState("17:00")
  const [weather, setWeather] = useState("")
  const [tempHigh, setTempHigh] = useState("")
  const [tempLow, setTempLow] = useState("")
  const [workSummary, setWorkSummary] = useState("")
  const [workCompleted, setWorkCompleted] = useState<string[]>([])
  const [newWorkItem, setNewWorkItem] = useState("")
  const [issues, setIssues] = useState<string[]>([])
  const [newIssue, setNewIssue] = useState("")
  const [safetyIncidents, setSafetyIncidents] = useState(false)
  const [safetyNotes, setSafetyNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!user) return null

  const activeJobs = jobs?.filter(j => j.status === 'scheduled' || j.status === 'in_progress') || []

  const handleAddWorkItem = () => {
    if (newWorkItem.trim()) {
      setWorkCompleted([...workCompleted, newWorkItem.trim()])
      setNewWorkItem("")
    }
  }

  const handleRemoveWorkItem = (index: number) => {
    setWorkCompleted(workCompleted.filter((_, i) => i !== index))
  }

  const handleAddIssue = () => {
    if (newIssue.trim()) {
      setIssues([...issues, newIssue.trim()])
      setNewIssue("")
    }
  }

  const handleRemoveIssue = (index: number) => {
    setIssues(issues.filter((_, i) => i !== index))
  }

  const handleSaveDraft = async () => {
    if (!selectedJob) {
      alert("Please select a job")
      return
    }

    try {
      await createReport.mutateAsync({
        job_id: selectedJob,
        report_date: reportDate,
        start_time: startTime,
        end_time: endTime,
        weather_condition: weather,
        temperature_high: tempHigh ? parseInt(tempHigh) : undefined,
        temperature_low: tempLow ? parseInt(tempLow) : undefined,
        work_summary: workSummary,
        work_completed: workCompleted,
        issues_encountered: issues,
        safety_incidents: safetyIncidents,
        safety_notes: safetyNotes,
      })
      alert("Draft saved successfully!")
    } catch (error) {
      console.error("Failed to save draft:", error)
      alert("Failed to save draft")
    }
  }

  const handleSubmit = async () => {
    if (!selectedJob) {
      alert("Please select a job")
      return
    }

    setIsSubmitting(true)
    try {
      const report = await createReport.mutateAsync({
        job_id: selectedJob,
        report_date: reportDate,
        start_time: startTime,
        end_time: endTime,
        weather_condition: weather,
        temperature_high: tempHigh ? parseInt(tempHigh) : undefined,
        temperature_low: tempLow ? parseInt(tempLow) : undefined,
        work_summary: workSummary,
        work_completed: workCompleted,
        issues_encountered: issues,
        safety_incidents: safetyIncidents,
        safety_notes: safetyNotes,
      })

      await submitReport.mutateAsync(report.id)
      alert("Report submitted successfully!")
      
      // Reset form
      setSelectedJob("")
      setWorkSummary("")
      setWorkCompleted([])
      setIssues([])
      setSafetyNotes("")
    } catch (error) {
      console.error("Failed to submit report:", error)
      alert("Failed to submit report")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Daily Report</h1>
          <p className="text-muted-foreground mt-1">
            Submit your daily job report
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(reportDate).toLocaleDateString()}
        </Badge>
      </div>

      {/* Job Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Job Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job">Select Job *</Label>
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
              <Label htmlFor="date">Report Date</Label>
              <Input
                id="date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Start Time
              </Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                End Time
              </Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weather */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weather">Condition</Label>
              <select
                id="weather"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Select...</option>
                <option value="sunny">Sunny</option>
                <option value="cloudy">Cloudy</option>
                <option value="rainy">Rainy</option>
                <option value="snowy">Snowy</option>
                <option value="windy">Windy</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempHigh">High (°F)</Label>
              <Input
                id="tempHigh"
                type="number"
                value={tempHigh}
                onChange={(e) => setTempHigh(e.target.value)}
                placeholder="75"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempLow">Low (°F)</Label>
              <Input
                id="tempLow"
                type="number"
                value={tempLow}
                onChange={(e) => setTempLow(e.target.value)}
                placeholder="55"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Work Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="summary">Summary of Work Performed</Label>
            <Textarea
              id="summary"
              value={workSummary}
              onChange={(e) => setWorkSummary(e.target.value)}
              placeholder="Describe the work completed today..."
              rows={4}
            />
          </div>

          {/* Work Completed Items */}
          <div className="space-y-2">
            <Label>Work Items Completed</Label>
            <div className="flex gap-2">
              <Input
                value={newWorkItem}
                onChange={(e) => setNewWorkItem(e.target.value)}
                placeholder="Add work item..."
                onKeyPress={(e) => e.key === 'Enter' && handleAddWorkItem()}
              />
              <Button type="button" onClick={handleAddWorkItem}>
                Add
              </Button>
            </div>
            {workCompleted.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {workCompleted.map((item, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {item}
                    <button
                      onClick={() => handleRemoveWorkItem(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Issues & Delays
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Issues Encountered</Label>
            <div className="flex gap-2">
              <Input
                value={newIssue}
                onChange={(e) => setNewIssue(e.target.value)}
                placeholder="Add issue..."
                onKeyPress={(e) => e.key === 'Enter' && handleAddIssue()}
              />
              <Button type="button" onClick={handleAddIssue}>
                Add
              </Button>
            </div>
            {issues.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {issues.map((issue, index) => (
                  <Badge key={index} variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {issue}
                    <button
                      onClick={() => handleRemoveIssue(index)}
                      className="ml-1 hover:text-white"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Safety */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Safety
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="safetyIncidents"
              checked={safetyIncidents}
              onChange={(e) => setSafetyIncidents(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="safetyIncidents">
              Were there any safety incidents today?
            </Label>
          </div>

          {safetyIncidents && (
            <div className="space-y-2">
              <Label htmlFor="safetyNotes">Safety Incident Details</Label>
              <Textarea
                id="safetyNotes"
                value={safetyNotes}
                onChange={(e) => setSafetyNotes(e.target.value)}
                placeholder="Describe the safety incident..."
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Photo upload coming soon. You can add photos after creating the report.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={createReport.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Draft
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || createReport.isPending}
        >
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? "Submitting..." : "Submit Report"}
        </Button>
      </div>
    </div>
  )
}
