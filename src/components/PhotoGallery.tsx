import { useState, useEffect, useCallback, useRef } from "react"
import { useGetPhotos, useDeletePhoto } from "@/hooks/usePhotos"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"
import { Trash2, ChevronLeft, ChevronRight, X } from "lucide-react"
import type { Photo } from "@/hooks/usePhotos"

interface PhotoGalleryProps {
  businessId: string
  bidId?: string
  jobId?: string
}

/** Skeleton loader for photo grid */
function PhotoSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[4/3] bg-gray-200 rounded-lg" />
          <div className="mt-2 space-y-1">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PhotoGallery({ businessId, bidId, jobId }: PhotoGalleryProps) {
  const { user } = useAuth()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  const { data: photos, isLoading } = useGetPhotos({ businessId, bidId, jobId })
  const deletePhoto = useDeletePhoto()

  const handleDelete = async (id: string) => {
    try {
      await deletePhoto.mutateAsync({ id, businessId, bidId, jobId })
      setDeleteConfirm(null)
      // Close lightbox if we deleted the currently viewed photo
      if (lightboxIndex !== null && photos) {
        const deletedIndex = photos.findIndex(p => p.id === id)
        if (deletedIndex === lightboxIndex) {
          setLightboxIndex(null)
        } else if (deletedIndex < lightboxIndex) {
          setLightboxIndex(lightboxIndex - 1)
        }
      }
    } catch (error) {
      console.error("Failed to delete photo:", error)
    }
  }

  const getPhaseBadge = (phase: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      bid: { label: "Before", variant: "secondary" },
      progress: { label: "During", variant: "default" },
      completion: { label: "After", variant: "outline" },
    }
    const c = config[phase] || { label: phase, variant: "default" as const }
    return <Badge variant={c.variant}>{c.label}</Badge>
  }

  // Lightbox navigation
  const goToPrev = useCallback(() => {
    if (lightboxIndex !== null && photos && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1)
    }
  }, [lightboxIndex, photos])

  const goToNext = useCallback(() => {
    if (lightboxIndex !== null && photos && lightboxIndex < photos.length - 1) {
      setLightboxIndex(lightboxIndex + 1)
    }
  }, [lightboxIndex, photos])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev()
      if (e.key === "ArrowRight") goToNext()
      if (e.key === "Escape") setLightboxIndex(null)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [lightboxIndex, goToPrev, goToNext])

  // Touch swipe for lightbox
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return

    const diff = touchStartX.current - touchEndX.current
    const threshold = 50 // minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNext() // Swipe left → next
      } else {
        goToPrev() // Swipe right → prev
      }
    }

    touchStartX.current = null
    touchEndX.current = null
  }

  if (isLoading) {
    return <PhotoSkeleton />
  }

  if (!photos || photos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No photos uploaded yet.</p>
        <p className="text-sm mt-1">Upload your first photo to get started.</p>
      </div>
    )
  }

  const currentPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null

  return (
    <>
      {/* Photo Grid: 1 col mobile, 2 col tablet, 3 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="group relative border rounded-lg overflow-hidden bg-white"
          >
            {/* Thumbnail */}
            <button
              onClick={() => setLightboxIndex(index)}
              className="w-full aspect-[4/3] relative overflow-hidden bg-gray-100 cursor-pointer"
              aria-label={`View photo: ${photo.description || "Job photo"}`}
            >
              <img
                src={photo.photo_url}
                alt={photo.description || "Job photo"}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </button>

            {/* Info bar */}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                {getPhaseBadge(photo.phase)}
                <span className="text-xs text-muted-foreground">
                  {formatDate(photo.created_at)}
                </span>
              </div>
              {photo.description && (
                <p className="text-sm truncate">{photo.description}</p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  by {photo.uploader.first_name} {photo.uploader.last_name}
                </p>
                {/* Delete button - only show if user uploaded this photo */}
                {user && photo.uploaded_by === user.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm(photo.id)
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Delete photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {currentPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white bg-black/50 rounded-full"
            aria-label="Close lightbox"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Navigation arrows */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goToPrev() }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white bg-black/50 rounded-full"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {lightboxIndex < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goToNext() }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white bg-black/50 rounded-full"
              aria-label="Next photo"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Image */}
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={currentPhoto.photo_url}
              alt={currentPhoto.description || "Job photo"}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Bottom info bar */}
          <div
            className="bg-black/80 text-white p-4 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getPhaseBadge(currentPhoto.phase)}
                <span className="text-sm text-white/70">
                  {lightboxIndex + 1} of {photos.length}
                </span>
              </div>
              {user && currentPhoto.uploaded_by === user.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirm(currentPhoto.id)}
                  className="text-white/80 hover:text-red-400 hover:bg-white/10"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            {currentPhoto.description && (
              <p className="text-sm">{currentPhoto.description}</p>
            )}
            <p className="text-xs text-white/50">
              {currentPhoto.uploader.first_name} {currentPhoto.uploader.last_name} · {formatDate(currentPhoto.created_at)}
            </p>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Photo</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this photo? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deletePhoto.isPending}
            >
              {deletePhoto.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
