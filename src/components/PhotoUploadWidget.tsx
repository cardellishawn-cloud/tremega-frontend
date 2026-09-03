import { useState, useRef, useCallback } from "react"
import { useUploadPhoto } from "@/hooks/usePhotos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Camera, Upload, X, ImageIcon, AlertCircle } from "lucide-react"

interface PhotoUploadWidgetProps {
  businessId: string
  bidId?: string
  jobId?: string
  onUploadComplete?: () => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_WIDTH = 1200
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

/** Resize an image file client-side to max 1200px width, return a Blob */
async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      if (img.width <= MAX_WIDTH) {
        // No resize needed, but still re-encode to strip EXIF
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        if (!ctx) { resolve(file); return }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (blob) => resolve(blob || file),
          "image/jpeg",
          0.85
        )
        return
      }

      const scale = MAX_WIDTH / img.width
      const canvas = document.createElement("canvas")
      canvas.width = MAX_WIDTH
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext("2d")
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(blob || file),
        "image/jpeg",
        0.85
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }

    img.src = url
  })
}

export function PhotoUploadWidget({ businessId, bidId, jobId, onUploadComplete }: PhotoUploadWidgetProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [phase, setPhase] = useState("progress")
  const [description, setDescription] = useState("")
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const uploadPhoto = useUploadPhoto()

  const validateAndSetFile = useCallback((f: File) => {
    setError(null)
    setSuccess(false)

    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Only JPG, PNG, and WebP images are allowed")
      return
    }

    if (f.size > MAX_FILE_SIZE) {
      setError("File too large. Maximum size is 5MB.")
      return
    }

    setFile(f)

    // Generate preview
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }, [])

  const clearFile = useCallback(() => {
    setFile(null)
    setPreview(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
  }, [])

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
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setError(null)

    try {
      // Resize image client-side before upload
      const resizedBlob = await resizeImage(file)

      await uploadPhoto.mutateAsync({
        file: resizedBlob,
        businessId,
        bidId,
        jobId,
        phase,
        description,
      })

      clearFile()
      setDescription("")
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onUploadComplete?.()
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Upload failed. Please try again."
      setError(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 p-3 text-sm text-green-700 bg-green-50 rounded-md">
          <Upload className="h-4 w-4 flex-shrink-0" />
          <span>Photo uploaded successfully!</span>
        </div>
      )}

      {/* File drop zone / preview */}
      {preview ? (
        <div className="relative border rounded-lg overflow-hidden">
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-64 object-contain bg-gray-50"
          />
          <button
            type="button"
            onClick={clearFile}
            className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center bg-black/60 text-white rounded-full hover:bg-black/80 active:bg-black/90"
            aria-label="Remove photo"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="p-3 bg-gray-50 border-t">
            <p className="text-sm text-muted-foreground truncate">{file?.name}</p>
            <p className="text-xs text-muted-foreground">
              {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}
              {file && file.size > MAX_WIDTH * 1 && " (will be resized)"}
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors min-h-[120px] flex flex-col items-center justify-center ${
            dragActive ? "border-primary bg-accent" : "border-muted"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Drag & drop a photo here, or
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Gallery picker */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px]"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Choose Photo
            </Button>
            {/* Camera capture (mobile) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[44px]"
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
            className="hidden"
            aria-label="Choose photo from gallery"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
            className="hidden"
            aria-label="Take photo with camera"
          />
        </div>
      )}

      {/* Phase + Description */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Phase</label>
          <Select value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="bid">Before (Bid)</option>
            <option value="progress">During (Progress)</option>
            <option value="completion">After (Completion)</option>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">Caption (optional)</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Photo caption..."
            maxLength={255}
          />
        </div>
      </div>

      {/* Upload button */}
      <Button
        type="submit"
        disabled={!file || uploadPhoto.isPending}
        className="w-full min-h-[44px]"
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploadPhoto.isPending ? "Uploading..." : "Upload Photo"}
      </Button>
    </form>
  )
}
