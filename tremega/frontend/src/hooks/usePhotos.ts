import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Photo {
  id: string
  job_id?: string
  bid_id?: string
  business_id: string
  uploaded_by: string
  photo_url: string
  description?: string
  phase: 'bid' | 'progress' | 'completion'
  created_at: string
  uploader: {
    id: string
    first_name: string
    last_name: string
  }
}

const PHOTOS_KEY = 'photos'

export function useGetPhotos(params: { businessId: string; bidId?: string; jobId?: string }) {
  return useQuery({
    queryKey: [PHOTOS_KEY, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      searchParams.append('businessId', params.businessId)
      if (params.bidId) searchParams.append('bidId', params.bidId)
      if (params.jobId) searchParams.append('jobId', params.jobId)
      
      const { data } = await api.get<Photo[]>(`/photos?${searchParams.toString()}`)
      return data
    },
    enabled: !!params.businessId && (!!params.bidId || !!params.jobId),
  })
}

export function useUploadPhoto() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: { file: File; businessId: string; bidId?: string; jobId?: string; phase: string; description?: string }) => {
      const formData = new FormData()
      formData.append('file', input.file)
      formData.append('businessId', input.businessId)
      if (input.bidId) formData.append('bidId', input.bidId)
      if (input.jobId) formData.append('jobId', input.jobId)
      formData.append('phase', input.phase)
      if (input.description) formData.append('description', input.description)
      
      const { data } = await api.post<Photo>('/photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [PHOTOS_KEY, { businessId: variables.businessId, bidId: variables.bidId, jobId: variables.jobId }] 
      })
    },
  })
}

export function useDeletePhoto() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, businessId, bidId, jobId }: { id: string; businessId: string; bidId?: string; jobId?: string }) => {
      await api.delete(`/photos/${id}`)
      return { id, businessId, bidId, jobId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ 
        queryKey: [PHOTOS_KEY, { businessId: result.businessId, bidId: result.bidId, jobId: result.jobId }] 
      })
    },
  })
}
