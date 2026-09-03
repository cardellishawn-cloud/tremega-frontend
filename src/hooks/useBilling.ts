import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Plan {
  id: string
  name: string
  price: number
  priceId: string
  features: string[]
}

export interface Subscription {
  plan_tier: string | null
  status: string
  current_period_end?: string
  cancel_at_period_end?: boolean
}

export function useGetPlans() {
  return useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const { data } = await api.get<Plan[]>('/billing/plans')
      return data
    },
    staleTime: 1000 * 60 * 30, // 30 min — plans rarely change
  })
}

export function useGetSubscription() {
  return useQuery({
    queryKey: ['billing-subscription'],
    queryFn: async () => {
      const { data } = await api.get<Subscription>('/billing/subscription')
      return data
    },
  })
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async (priceId: string) => {
      const { data } = await api.post<{ sessionId: string; url: string }>('/billing/create-checkout', { priceId })
      return data
    },
  })
}

export function useCancelSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/billing/cancel')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscription'] })
    },
  })
}
