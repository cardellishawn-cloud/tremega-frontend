import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Sub {
  id: string
  name: string
  email: string
  phone?: string
  skills: string[]
  rating: number
  performance_score: number
  total_jobs_completed: number
  status: string
  created_at: string
  updated_at: string
}

export interface SubPerformance {
  performance: {
    total_assignments: number
    completed_on_time: number
    completion_rate: number
    avg_turnaround_hours: number
  }
  recentAssignments: Array<{
    id: string
    status: string
    assigned_at: string
    started_at: string
    completed_at: string
    bid_line_items: {
      description: string
      type: string
      total: number
    }
  }>
}

const SUBS_KEY = 'subs'

export function useGetSubs(businessId: string) {
  return useQuery({
    queryKey: [SUBS_KEY, businessId],
    queryFn: async () => {
      const { data } = await api.get<Sub[]>(`/subs`)
      return data
    },
    enabled: !!businessId,
  })
}

export function useInviteSub() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: { email: string; firstName: string; lastName: string; businessId: string }) => {
      const { data } = await api.post('/subs', input)
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [SUBS_KEY, variables.businessId] })
    },
  })
}

export function useGetSubPerformance(subId: string, businessId: string) {
  return useQuery({
    queryKey: [SUBS_KEY, subId, 'performance', businessId],
    queryFn: async () => {
      const { data } = await api.get<SubPerformance>(`/subs/${subId}/performance?businessId=${businessId}`)
      return data
    },
    enabled: !!subId && !!businessId,
  })
}

export function useUpdateSub() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, businessId, ...input }: { id: string; businessId: string; firstName?: string; lastName?: string; status?: string }) => {
      const { data } = await api.put(`/subs/${id}?businessId=${businessId}`, input)
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [SUBS_KEY, variables.businessId] })
    },
  })
}

export function useRemoveSub() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, businessId }: { id: string; businessId: string }) => {
      await api.delete(`/subs/${id}?businessId=${businessId}`)
      return id
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [SUBS_KEY, variables.businessId] })
    },
  })
}
