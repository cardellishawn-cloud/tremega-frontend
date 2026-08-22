import { useState } from "react"
import { useGetPhotos, useDeletePhoto } from "@/hooks/usePhotos"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { Trash2, ZoomIn } from "lucide-react"

interface PhotoGalleryProps {
  businessId: string
  bidId?: string
  jobId?: string
  canDelete?: boolean
}

export function PhotoGallery({ businessId, bidId, jobId, canDelete = false }: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  
  const { data: photos, isLoading } = useGetPhotos({ businessId, bidId, jobId })
  const deletePhoto = useDeletePhoto()

  const handleDelete = async (id: string) => {
    try {
      await deletePhoto.mutateAsync({ id, businessId, bidId, jobId })
    } catch (error) {
      console.error("Failed to delete photo:", error)
    }
  }

  const getPhaseBadge = (phase: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      bid: "secondary",
      progress: "default",
      completion: "outline",
    }
    return <Badge variant={variants[phase] || "default"}>{phase}</Badge>
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading photos...</div>
  }

  if (!photos || photos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No photos uploaded yet
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <Card key={photo.id} className="overflow-hidden">
            <div className="relative aspect-square">
              <img
                src={photo.photo_url}
                alt={photo.description || "Job photo"}
                className="object-cover w-full h-full"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setSelectedPhoto(photo.id)}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(photo.id)}
                    disabled={deletePhoto.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                {getPhaseBadge(photo.phase)}
                <span className="text-xs text-muted-foreground">
                  {formatDate(photo.created_at)}
                </span>
              </div>
              {photo.description && (
                <p className="text-sm truncate">{photo.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                by {photo.uploader.first_name} {photo.uploader.last_name}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          {selectedPhoto && (
            <>
              <DialogHeader>
                <DialogTitle>Photo Details</DialogTitle>
              </DialogHeader>
              {(() => {
                const photo = photos.find(p => p.id === selectedPhoto)
                if (!photo) return null
                return (
                  <div className="space-y-4">
                    <img
                      src={photo.photo_url}
                      alt={photo.description || "Job photo"}
                      className="w-full max-h-[70vh] object-contain"
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        {getPhaseBadge(photo.phase)}
                        <p className="text-sm text-muted-foreground mt-1">
                          Uploaded by {photo.uploader.first_name} {photo.uploader.last_name} on {formatDate(photo.created_at)}
                        </p>
                        {photo.description && (
                          <p className="mt-2">{photo.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
