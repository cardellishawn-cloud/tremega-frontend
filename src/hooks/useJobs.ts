import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Job {
  id: string
  customer_id: string
  business_id: string
  title: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
}

export interface CreateJobInput {
  customer_id: string
  title: string
  notes?: string
}

export interface UpdateJobInput {
  title?: string
  status?: Job['status']
  notes?: string
}

const JOBS_KEY = 'jobs'

// Fetch all jobs
export function useGetJobs(filters?: { status?: string; customerId?: string }) {
  return useQuery({
    queryKey: [JOBS_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status) params.append('status', filters.status)
      if (filters?.customerId) params.append('customerId', filters.customerId)
      
      const { data } = await api.get<Job[]>(`/jobs?${params.toString()}`)
      return data
    },
  })
}

// Fetch single job
export function useGetJob(id: string) {
  return useQuery({
    queryKey: [JOBS_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<Job>(`/jobs/${id}`)
      return data
    },
    enabled: !!id,
  })
}

// Create job
export function useCreateJob() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: CreateJobInput) => {
      const { data } = await api.post<Job>('/jobs', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JOBS_KEY] })
    },
  })
}

// Update job
export function useUpdateJob() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateJobInput & { id: string }) => {
      const { data } = await api.put<Job>(`/jobs/${id}`, input)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [JOBS_KEY] })
      queryClient.invalidateQueries({ queryKey: [JOBS_KEY, data.id] })
    },
  })
}

// Delete job
export function useDeleteJob() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/jobs/${id}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JOBS_KEY] })
    },
  })
}
