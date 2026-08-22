import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Notification {
  id: string
  user_id: string
  business_id: string
  type: 'sub_assignment' | 'message' | 'job_update' | 'photo_upload'
  title: string
  description?: string
  related_id?: string
  related_type?: string
  read: boolean
  created_at: string
}

const NOTIFICATIONS_KEY = 'notifications'

export function useGetNotifications(businessId: string, read?: boolean) {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, businessId, read],
    queryFn: async () => {
      let url = `/notifications?businessId=${businessId}`
      if (read !== undefined) {
        url += `&read=${read}`
      }
      const { data } = await api.get<{ notifications: Notification[]; unreadCount: number }>(url)
      return data
    },
    enabled: !!businessId,
    refetchInterval: false, // Disabled polling to prevent flickering
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, businessId }: { id: string; businessId: string }) => {
      const { data } = await api.put(`/notifications/${id}/read`)
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY, variables.businessId] })
    },
  })
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (businessId: string) => {
      await api.put(`/notifications/mark-all-read?businessId=${businessId}`)
    },
    onSuccess: (_, businessId) => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY, businessId] })
    },
  })
}
