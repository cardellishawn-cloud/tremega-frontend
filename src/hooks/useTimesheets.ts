import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface CrewTimesheet {
  id: string
  job_id: string
  daily_report_id?: string
  crew_id: string
  crew_name?: string
  crew_role?: string
  clock_in: string
  clock_out?: string
  break_minutes: number
  total_hours?: number
  labor_rate?: number
  labor_cost?: number
  tasks_completed: string[]
  task_notes?: string
  photo_ids: string[]
  notes?: string
  issues?: string
  status: 'active' | 'completed' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export interface ClockInInput {
  job_id: string
  crew_id: string
  crew_name?: string
  crew_role?: string
  labor_rate?: number
}

export interface ClockOutInput {
  tasks_completed?: string[]
  task_notes?: string
  break_minutes?: number
  notes?: string
  issues?: string
}

const TIMESHEETS_KEY = 'crew-timesheets'

// Fetch timesheets for job
export function useGetTimesheets(jobId: string, date?: string) {
  return useQuery({
    queryKey: [TIMESHEETS_KEY, jobId, date],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (date) params.append('date', date)
      
      const { data } = await api.get<CrewTimesheet[]>(`/daily-reports/timesheets/${jobId}?${params.toString()}`)
      return data
    },
    enabled: !!jobId,
  })
}

// Clock in
export function useClockIn() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: ClockInInput) => {
      const { data } = await api.post<CrewTimesheet>('/daily-reports/timesheets/clock-in', input)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [TIMESHEETS_KEY, data.job_id] })
    },
  })
}

// Clock out
export function useClockOut() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...input }: ClockOutInput & { id: string }) => {
      const { data } = await api.post<CrewTimesheet>(`/daily-reports/timesheets/${id}/clock-out`, input)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [TIMESHEETS_KEY, data.job_id] })
    },
  })
}
