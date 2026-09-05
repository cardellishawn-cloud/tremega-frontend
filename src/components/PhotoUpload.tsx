import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Camera, Upload, X, ImageIcon } from 'lucide-react'
import { useState, useCallback } from 'react'

interface Photo {
  id: string
  url: string
  file?: File
  caption?: string
}

interface PhotoUploadProps {
  photos: Photo[]
  onPhotosChange: (photos: Photo[]) => void
  maxPhotos?: number
}

export function PhotoUpload({ photos, onPhotosChange, maxPhotos = 10 }: PhotoUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      )

      if (files.length > 0) {
        const newPhotos = files.slice(0, maxPhotos - photos.length).map((file) => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          url: URL.createObjectURL(file),
          file,
        }))
        onPhotosChange([...photos, ...newPhotos])
      }
    },
    [photos, maxPhotos, onPhotosChange]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) =>
      file.type.startsWith('image/')
    )

    if (files.length > 0) {
      const newPhotos = files.slice(0, maxPhotos - photos.length).map((file) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        url: URL.createObjectURL(file),
        file,
      }))
      onPhotosChange([...photos, ...newPhotos])
    }
  }

  const handleRemovePhoto = (id: string) => {
    const photo = photos.find((p) => p.id === id)
    if (photo?.url.startsWith('blob:')) {
      URL.revokeObjectURL(photo.url)
    }
    onPhotosChange(photos.filter((p) => p.id !== id))
  }

  return (
    <Card className="border-l-4 border-l-blue-600">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Camera className="h-5 w-5 text-blue-600" />
          </div>
          <span>Photos</span>
          <span className="text-sm font-normal text-gray-500">
            ({photos.length}/{maxPhotos})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <motion.div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          animate={{
            borderColor: isDragging ? '#1F3A93' : '#D1D5DB',
            backgroundColor: isDragging ? 'rgba(31, 58, 147, 0.05)' : 'transparent',
          }}
          className={`
            relative border-3 border-dashed rounded-xl p-8 sm:p-12
            flex flex-col items-center justify-center
            cursor-pointer transition-colors
            ${isDragging ? 'border-blue-600' : 'border-gray-300 hover:border-blue-400'}
          `}
          onClick={() => document.getElementById('photo-input')?.click()}
        >
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          <motion.div
            animate={{ y: isDragging ? -5 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Upload
              className={`h-12 w-12 mb-4 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`}
            />
          </motion.div>

          <p className={`text-lg font-medium ${isDragging ? 'text-blue-600' : 'text-gray-600'}`}>
            {isDragging ? 'Drop photos here' : 'Drag photos here or click to select'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Supports: JPG, PNG, GIF (max {maxPhotos} photos)
          </p>
        </motion.div>

        {/* Photo Grid */}
        <AnimatePresence>
          {photos.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {photos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100"
                >
                  <img
                    src={photo.url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemovePhoto(photo.id)
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>

                  {/* Quick remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemovePhoto(photo.id)
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                  >
                    <X className="h-4 w-4 text-gray-600" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {photos.length === 0 && (
          <div className="text-center py-4 text-gray-400">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No photos added yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default PhotoUpload
