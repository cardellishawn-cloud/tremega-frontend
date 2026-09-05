import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { useCreateDailyReport, useSubmitDailyReport } from '@/hooks/useDailyReports'
import { useGetJobs } from '@/hooks/useJobs'
import { useWeather } from '@/hooks/useWeather'
import { HeroSection } from '@/components/HeroSection'
import { WeatherWidget } from '@/components/WeatherWidget'
import { CrewSelector } from '@/components/CrewSelector'
import { PhotoUpload } from '@/components/PhotoUpload'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Send,
  Loader2,
  Plus,
  X,
} from 'lucide-react'

interface CrewMember {
  id: string
  name: string
  role: string
  rate: number
}

interface Photo {
  id: string
  url: string
  file?: File
  caption?: string
}

// Collapsible Card Component
function CollapsibleCard({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-l-4 border-l-blue-600 overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full text-left"
        >
          <CardHeader className="pb-4 hover:bg-gray-50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <span>{title}</span>
              </div>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </motion.div>
            </CardTitle>
          </CardHeader>
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent className="pt-0">{children}</CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

// Success State Component
function SuccessState({ onNewReport, onBackToDashboard }: { onNewReport: () => void; onBackToDashboard: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
      >
        <CheckCircle className="h-12 w-12 text-green-600" />
      </motion.div>
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Daily Report Submitted!</h2>
      <p className="text-gray-600 mb-2">Your report has been submitted successfully.</p>
      <p className="text-sm text-gray-400 mb-8">
        Submitted at {new Date().toLocaleTimeString()} on {new Date().toLocaleDateString()}
      </p>
      <div className="flex gap-4">
        <Button onClick={onNewReport} size="lg" className="bg-blue-600 hover:bg-blue-700">
          Create New Report
        </Button>
        <Button onClick={onBackToDashboard} variant="outline" size="lg">
          Back to Dashboard
        </Button>
      </div>
    </motion.div>
  )
}

export function PremiumDailyReportForm() {
  const { user } = useAuth()
  const { data: jobs } = useGetJobs()
  const createReport = useCreateDailyReport()
  const submitReport = useSubmitDailyReport()

  // Form state
  const [selectedJob, setSelectedJob] = useState('')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('17:00')
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [workSummary, setWorkSummary] = useState('')
  const [workCompleted, setWorkCompleted] = useState<string[]>([])
  const [newWorkItem, setNewWorkItem] = useState('')
  const [issues, setIssues] = useState<string[]>([])
  const [newIssue, setNewIssue] = useState('')
  const [safetyIncidents, setSafetyIncidents] = useState(false)
  const [safetyNotes, setSafetyNotes] = useState('')

  // Weather state
  const [manualWeather, setManualWeather] = useState<{
    temp: number
    condition: string
    high: number
    low: number
  } | null>(null)

  // Get selected job details
  const selectedJobData = jobs?.find((j) => j.id === selectedJob)

  // Fetch weather
  const { weather, loading: weatherLoading, error: weatherError, refresh: refreshWeather } = useWeather({
    address: selectedJobData?.customer_name || undefined,
    enabled: !!selectedJob,
  })

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  if (!user) return null

  const activeJobs = jobs?.filter((j) => j.status === 'scheduled' || j.status === 'in_progress') || []

  // Calculate total hours
  const calculateHours = () => {
    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)
    return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60))
  }

  const handleAddWorkItem = () => {
    if (newWorkItem.trim()) {
      setWorkCompleted([...workCompleted, newWorkItem.trim()])
      setNewWorkItem('')
    }
  }

  const handleRemoveWorkItem = (index: number) => {
    setWorkCompleted(workCompleted.filter((_, i) => i !== index))
  }

  const handleAddIssue = () => {
    if (newIssue.trim()) {
      setIssues([...issues, newIssue.trim()])
      setNewIssue('')
    }
  }

  const handleRemoveIssue = (index: number) => {
    setIssues(issues.filter((_, i) => i !== index))
  }

  const handleManualWeatherOverride = (data: { temp: number; condition: string; high: number; low: number }) => {
    setManualWeather(data)
  }

  const handleSubmit = async () => {
    if (!selectedJob) {
      alert('Please select a job')
      return
    }

    setIsSubmitting(true)
    try {
      const weatherData = manualWeather || weather

      const report = await createReport.mutateAsync({
        job_id: selectedJob,
        report_date: reportDate,
        crew_ids: crew.map((c) => c.id),
        start_time: startTime,
        end_time: endTime,
        weather_condition: weatherData?.condition || 'Clear',
        temperature_high: weatherData?.high,
        temperature_low: weatherData?.low,
        work_summary: workSummary,
        work_completed: workCompleted,
        issues_encountered: issues,
        safety_incidents: safetyIncidents,
        safety_notes: safetyNotes,
      })

      await submitReport.mutateAsync(report.id)
      setShowSuccess(true)
    } catch (error) {
      console.error('Failed to submit report:', error)
      alert('Failed to submit report')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNewReport = () => {
    setShowSuccess(false)
    setSelectedJob('')
    setCrew([])
    setPhotos([])
    setWorkSummary('')
    setWorkCompleted([])
    setIssues([])
    setSafetyNotes('')
    setManualWeather(null)
  }

  const handleBackToDashboard = () => {
    window.location.href = '/dashboard'
  }

  if (showSuccess) {
    return <SuccessState onNewReport={handleNewReport} onBackToDashboard={handleBackToDashboard} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <HeroSection
        jobName={selectedJobData?.title || 'Select a Job'}
        jobLocation={selectedJobData?.customer_name}
        crewCount={crew.length}
        totalHours={calculateHours()}
        status="In Progress"
      />

      {/* Weather Widget */}
      <WeatherWidget
        weather={manualWeather ? {
          temp: manualWeather.temp,
          condition: manualWeather.condition,
          description: manualWeather.condition,
          high: manualWeather.high,
          low: manualWeather.low,
          wind: 0,
          humidity: 0,
          icon: manualWeather.condition.toLowerCase(),
          forecast: [],
          lastUpdated: new Date(),
        } : weather}
        loading={weatherLoading}
        error={weatherError}
        onRefresh={refreshWeather}
        onManualOverride={handleManualWeatherOverride}
      />

      {/* Main Form */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Job Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="border-l-4 border-l-blue-600">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <span>Job Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="job">Select Job *</Label>
                  <select
                    id="job"
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
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
                    className="p-3 border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="p-3 border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="p-3 border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Crew Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <CrewSelector selectedCrew={crew} onCrewChange={setCrew} />
        </motion.div>

        {/* Work Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <CollapsibleCard title="Work Summary" icon={FileText} defaultOpen>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="summary">Summary of Work Performed</Label>
                <Textarea
                  id="summary"
                  value={workSummary}
                  onChange={(e) => setWorkSummary(e.target.value)}
                  placeholder="Describe the work completed today..."
                  rows={4}
                  className="min-h-[120px] resize-y border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-2">
                <Label>Work Items Completed</Label>
                <div className="flex gap-2">
                  <Input
                    value={newWorkItem}
                    onChange={(e) => setNewWorkItem(e.target.value)}
                    placeholder="Add work item..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddWorkItem()}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  />
                  <Button type="button" onClick={handleAddWorkItem} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {workCompleted.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {workCompleted.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3" />
                          {item}
                          <button
                            onClick={() => handleRemoveWorkItem(index)}
                            className="ml-1 hover:text-red-500 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleCard>
        </motion.div>

        {/* Issues & Delays */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <CollapsibleCard title="Issues & Delays" icon={AlertTriangle}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Issues Encountered</Label>
                <div className="flex gap-2">
                  <Input
                    value={newIssue}
                    onChange={(e) => setNewIssue(e.target.value)}
                    placeholder="Add issue..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddIssue()}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  />
                  <Button type="button" onClick={handleAddIssue} className="bg-orange-500 hover:bg-orange-600">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {issues.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {issues.map((issue, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge variant="destructive" className="flex items-center gap-1 px-3 py-1.5">
                          <AlertTriangle className="h-3 w-3" />
                          {issue}
                          <button
                            onClick={() => handleRemoveIssue(index)}
                            className="ml-1 hover:text-white transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleCard>
        </motion.div>

        {/* Safety */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <CollapsibleCard title="Safety" icon={Shield}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="safetyIncidents"
                  checked={safetyIncidents}
                  onChange={(e) => setSafetyIncidents(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="safetyIncidents" className="text-base">
                  Were there any safety incidents today?
                </Label>
              </div>

              <AnimatePresence>
                {safetyIncidents && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="safetyNotes">Safety Incident Details</Label>
                    <Textarea
                      id="safetyNotes"
                      value={safetyNotes}
                      onChange={(e) => setSafetyNotes(e.target.value)}
                      placeholder="Describe the safety incident..."
                      rows={3}
                      className="border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CollapsibleCard>
        </motion.div>

        {/* Photo Upload */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
        >
          <PhotoUpload photos={photos} onPhotosChange={setPhotos} maxPhotos={10} />
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.9 }}
          className="pt-6"
        >
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedJob}
            className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:bg-gray-300 disabled:hover:scale-100"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Submit Daily Report
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

export default PremiumDailyReportForm
