import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { PhotoUploadWidget } from "@/components/PhotoUploadWidget"
import { PhotoGallery } from "@/components/PhotoGallery"
import { Briefcase, Camera } from "lucide-react"

// TODO: Replace with real job data from API when jobs endpoint is ready
// For now, allow manual job ID entry or use a placeholder
const DEMO_JOBS = [
  { id: "job-1", title: "Kitchen Remodel - Smith", status: "in_progress" },
  { id: "job-2", title: "Bathroom Renovation - Johnson", status: "in_progress" },
  { id: "job-3", title: "Deck Build - Williams", status: "pending" },
]

const BUSINESS_ID = "biz-1" // TODO: Get from auth context

export function JobsPage() {
  const { user } = useAuth()
  const [selectedJobId, setSelectedJobId] = useState<string>(DEMO_JOBS[0]?.id || "")
  const [showUpload, setShowUpload] = useState(false)

  if (!user) return null

  const selectedJob = DEMO_JOBS.find(j => j.id === selectedJobId)

  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground mt-1">Track progress with photos</p>
        </div>
      </div>

      {/* Job selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Select Job
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full sm:max-w-md"
          >
            {DEMO_JOBS.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {selectedJob && (
        <>
          {/* Job details + photos layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left: Job details */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{selectedJob.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Status</span>
                    <p className="font-medium capitalize">{selectedJob.status.replace("_", " ")}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Job ID</span>
                    <p className="font-mono text-sm">{selectedJob.id}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Upload toggle */}
              <Card>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setShowUpload(!showUpload)}
                >
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      Add Photos
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {showUpload ? "Hide" : "Show"}
                    </span>
                  </CardTitle>
                </CardHeader>
                {showUpload && (
                  <CardContent>
                    <PhotoUploadWidget
                      businessId={BUSINESS_ID}
                      jobId={selectedJobId}
                    />
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Right: Photo gallery */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Photos</CardTitle>
                </CardHeader>
                <CardContent>
                  <PhotoGallery
                    businessId={BUSINESS_ID}
                    jobId={selectedJobId}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
