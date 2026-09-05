import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface JobPhoto {
  id: string
  job_id: string
  daily_report_id?: string
  timesheet_id?: string
  photo_url: string
  thumbnail_url?: string
  caption?: string
  photo_type: 'before' | 'progress' | 'after' | 'issue' | 'safety' | 'other'
  tags: string[]
  latitude?: number
  longitude?: number
  location_name?: string
  taken_at: string
  uploaded_by: string
  created_at: string
}

export interface UploadPhotoInput {
  job_id: string
  photo_url: string
  thumbnail_url?: string
  caption?: string
  photo_type?: JobPhoto['photo_type']
  tags?: string[]
  latitude?: number
  longitude?: number
  location_name?: string
  daily_report_id?: string
  timesheet_id?: string
}

const JOB_PHOTOS_KEY = 'job-photos'

// Fetch photos for job
export function useGetJobPhotos(jobId: string, filters?: { type?: string; date?: string }) {
  return useQuery({
    queryKey: [JOB_PHOTOS_KEY, jobId, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.type) params.append('type', filters.type)
      if (filters?.date) params.append('date', filters.date)
      
      const { data } = await api.get<JobPhoto[]>(`/daily-reports/photos/${jobId}?${params.toString()}`)
      return data
    },
    enabled: !!jobId,
  })
}

// Upload photo
export function useUploadJobPhoto() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: UploadPhotoInput) => {
      const { data } = await api.post<JobPhoto>('/daily-reports/photos', input)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [JOB_PHOTOS_KEY, data.job_id] })
    },
  })
}
