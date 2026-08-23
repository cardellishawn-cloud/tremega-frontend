import { useState } from "react"
import { useUploadPhoto } from "@/hooks/usePhotos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Camera, Upload } from "lucide-react"

interface PhotoUploadWidgetProps {
  businessId: string
  bidId?: string
  jobId?: string
  onUploadComplete?: () => void
}

export function PhotoUploadWidget({ businessId, bidId, jobId, onUploadComplete }: PhotoUploadWidgetProps) {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState("progress")
  const [description, setDescription] = useState("")
  const [dragActive, setDragActive] = useState(false)
  
  const uploadPhoto = useUploadPhoto()

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    
    try {
      await uploadPhoto.mutateAsync({
        file,
        businessId,
        bidId,
        jobId,
        phase,
        description,
      })
      setFile(null)
      setDescription("")
      onUploadComplete?.()
    } catch (error) {
      console.error("Failed to upload photo:", error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive ? "border-primary bg-accent" : "border-muted"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
          id="photo-upload"
        />
        <label htmlFor="photo-upload" className="cursor-pointer">
          <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {file ? file.name : "Drag & drop a photo here, or click to select"}
          </p>
        </label>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Phase</label>
          <Select value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="bid">Bid</option>
            <option value="progress">Progress</option>
            <option value="completion">Completion</option>
          </Select>
        </div>
        
        <div>
          <label className="text-sm font-medium">Description (optional)</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Photo description..."
          />
        </div>
      </div>
      
      <Button type="submit" disabled={!file || uploadPhoto.isPending} className="w-full">
        <Upload className="mr-2 h-4 w-4" />
        {uploadPhoto.isPending ? "Uploading..." : "Upload Photo"}
      </Button>
    </form>
  )
}
