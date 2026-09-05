import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface DailyReport {
  id: string
  job_id: string
  report_date: string
  crew_ids: string[]
  crew_count: number
  start_time?: string
  end_time?: string
  total_hours?: number
  weather_condition?: string
  temperature_high?: number
  temperature_low?: number
  weather_notes?: string
  work_summary?: string
  work_completed: string[]
  issues_encountered: string[]
  delays?: string
  safety_incidents: boolean
  safety_notes?: string
  photo_ids: string[]
  supervisor_id?: string
  supervisor_signature?: string
  supervisor_signed_at?: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  created_by: string
  created_at: string
  updated_at: string
  jobs?: {
    id: string
    title: string
  }
  supervisor?: {
    id: string
    full_name: string
  }
}

export interface CreateDailyReportInput {
  job_id: string
  report_date?: string
  crew_ids?: string[]
  start_time?: string
  end_time?: string
  weather_condition?: string
  temperature_high?: number
  temperature_low?: number
  weather_notes?: string
  work_summary?: string
  work_completed?: string[]
  issues_encountered?: string[]
  delays?: string
  safety_incidents?: boolean
  safety_notes?: string
}

const DAILY_REPORTS_KEY = 'daily-reports'

// Fetch daily reports
export function useGetDailyReports(filters?: { jobId?: string; date?: string; status?: string }) {
  return useQuery({
    queryKey: [DAILY_REPORTS_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.jobId) params.append('jobId', filters.jobId)
      if (filters?.date) params.append('date', filters.date)
      if (filters?.status) params.append('status', filters.status)
      
      const { data } = await api.get<DailyReport[]>(`/daily-reports?${params.toString()}`)
      return data
    },
  })
}

// Fetch single daily report
export function useGetDailyReport(id: string) {
  return useQuery({
    queryKey: [DAILY_REPORTS_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<DailyReport>(`/daily-reports/${id}`)
      return data
    },
    enabled: !!id,
  })
}

// Create daily report
export function useCreateDailyReport() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: CreateDailyReportInput) => {
      const { data } = await api.post<DailyReport>('/daily-reports', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DAILY_REPORTS_KEY] })
    },
  })
}

// Update daily report
export function useUpdateDailyReport() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateDailyReportInput> & { id: string }) => {
      const { data } = await api.put<DailyReport>(`/daily-reports/${id}`, input)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [DAILY_REPORTS_KEY] })
      queryClient.invalidateQueries({ queryKey: [DAILY_REPORTS_KEY, data.id] })
    },
  })
}

// Submit daily report
export function useSubmitDailyReport() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<DailyReport>(`/daily-reports/${id}/submit`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DAILY_REPORTS_KEY] })
    },
  })
}
