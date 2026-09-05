import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useGetNotifications, useMarkAsRead, useMarkAllAsRead } from "@/hooks/useNotifications"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"
import { Bell, Check, CheckCheck } from "lucide-react"

export function NotificationCenter() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const userId = user?.id || ""
  const { data, isLoading } = useGetNotifications(userId)
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  const unreadCount = data?.unreadCount || 0
  const notifications = data?.notifications || []

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead.mutateAsync({ id, businessId: userId })
    } catch (error) {
      console.error("Failed to mark as read:", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead.mutateAsync(userId)
    } catch (error) {
      console.error("Failed to mark all as read:", error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'sub_assignment':
        return '📋'
      case 'message':
        return '💬'
      case 'job_update':
        return '🔧'
      case 'photo_upload':
        return '📷'
      default:
        return '🔔'
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Notifications</DialogTitle>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleMarkAllAsRead}
                disabled={markAllAsRead.isPending}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all read
              </Button>
            )}
          </DialogHeader>
          
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border ${
                      notification.read ? 'bg-background' : 'bg-accent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                        <div>
                          <p className={`font-medium ${notification.read ? 'text-muted-foreground' : ''}`}>
                            {notification.title}
                          </p>
                          {notification.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(notification.created_at)}
                          </p>
                        </div>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={markAsRead.isPending}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
