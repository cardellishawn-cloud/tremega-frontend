import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface SubAssignment {
  id: string
  status: 'assigned' | 'started' | 'completed'
  assignedDate: string
  startedAt?: string
  completedAt?: string
  lineItem: {
    id: string
    description: string
    type: string
    quantity: number
    unit: string
    unitPrice: number
    total: number
  }
}

const ASSIGNMENTS_KEY = 'sub-assignments'

export function useGetMyAssignments(status?: string) {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : ''
      const { data } = await api.get<SubAssignment[]>(`/bids/sub-assignments${params}`)
      return data
    },
  })
}

export function useAssignSubToLineItem() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ bidId, lineItemId, subUserId }: { bidId: string; lineItemId: string; subUserId: string }) => {
      const url = `/bids/${bidId}/line-items/${lineItemId}/assign-sub`
      const body = { subUserId }
      console.log('[useAssignSubToLineItem] POST', url, 'body:', JSON.stringify(body))
      const { data } = await api.post(url, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['bids'] })
    },
  })
}

export function useStartAssignment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data } = await api.put(`/bids/sub-assignments/${assignmentId}/start`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] })
    },
  })
}

export function useCompleteAssignment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data } = await api.put(`/bids/sub-assignments/${assignmentId}/complete`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] })
    },
  })
}
