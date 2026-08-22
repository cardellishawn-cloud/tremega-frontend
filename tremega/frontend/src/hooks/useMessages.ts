import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Message {
  id: string
  bid_id?: string
  job_id?: string
  sub_assignment_id?: string
  business_id: string
  sender_id: string
  content: string
  created_at: string
  sender: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
}

const MESSAGES_KEY = 'messages'

export function useGetMessages(params: { businessId: string; bidId?: string; jobId?: string; subAssignmentId?: string }) {
  return useQuery({
    queryKey: [MESSAGES_KEY, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      searchParams.append('businessId', params.businessId)
      if (params.bidId) searchParams.append('bidId', params.bidId)
      if (params.jobId) searchParams.append('jobId', params.jobId)
      if (params.subAssignmentId) searchParams.append('subAssignmentId', params.subAssignmentId)
      
      const { data } = await api.get<Message[]>(`/messages?${searchParams.toString()}`)
      return data
    },
    enabled: !!params.businessId && (!!params.bidId || !!params.jobId || !!params.subAssignmentId),
    refetchInterval: false, // Disabled polling to prevent flickering
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: { content: string; businessId: string; bidId?: string; jobId?: string; subAssignmentId?: string }) => {
      const { data } = await api.post<Message>('/messages', input)
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [MESSAGES_KEY, { 
          businessId: variables.businessId, 
          bidId: variables.bidId, 
          jobId: variables.jobId, 
          subAssignmentId: variables.subAssignmentId 
        }] 
      })
    },
  })
}
