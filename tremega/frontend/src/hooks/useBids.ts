import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Bid, CreateBidInput, UpdateBidInput, BidFilters } from '@/types'

const BIDS_KEY = 'bids'

// Fetch all bids with optional filters
export function useGetBids(filters?: BidFilters) {
  return useQuery({
    queryKey: [BIDS_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status) params.append('status', filters.status)
      if (filters?.customerId) params.append('customerId', filters.customerId)
      if (filters?.businessId) params.append('businessId', filters.businessId)
      if (filters?.createdBy) params.append('createdBy', filters.createdBy)
      
      const { data } = await api.get<Bid[]>(`/bids?${params.toString()}`)
      return data
    },
  })
}

// Fetch single bid
export function useGetBid(id: string) {
  return useQuery({
    queryKey: [BIDS_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<Bid>(`/bids/${id}`)
      return data
    },
    enabled: !!id,
  })
}

// Create bid
export function useCreateBid() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: CreateBidInput) => {
      const { data } = await api.post<Bid>('/bids', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY] })
    },
  })
}

// Update bid
export function useUpdateBid() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateBidInput & { id: string }) => {
      const { data } = await api.put<Bid>(`/bids/${id}`, input)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY] })
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY, data.id] })
    },
  })
}

// Send bid
export function useSendBid() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Bid>(`/bids/${id}/send`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY] })
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY, data.id] })
    },
  })
}

// Accept bid
export function useAcceptBid() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.put<{ bid: Bid; job: any }>(`/bids/${id}/accept`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY] })
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY, data.bid.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

// Reject bid
export function useRejectBid() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.put<Bid>(`/bids/${id}/reject`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY] })
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY, data.id] })
    },
  })
}

// Delete bid
export function useDeleteBid() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/bids/${id}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BIDS_KEY] })
    },
  })
}
