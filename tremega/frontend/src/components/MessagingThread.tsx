import { useState } from "react"
import { useGetMessages, useSendMessage } from "@/hooks/useMessages"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/utils"
import { Send } from "lucide-react"

interface MessagingThreadProps {
  businessId: string
  bidId?: string
  jobId?: string
  subAssignmentId?: string
}

export function MessagingThread({ businessId, bidId, jobId, subAssignmentId }: MessagingThreadProps) {
  const [message, setMessage] = useState("")
  
  const { data: messages, isLoading } = useGetMessages({ businessId, bidId, jobId, subAssignmentId })
  const sendMessage = useSendMessage()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    
    try {
      await sendMessage.mutateAsync({
        content: message,
        businessId,
        bidId,
        jobId,
        subAssignmentId,
      })
      setMessage("")
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading messages...</div>
        ) : messages?.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No messages yet</div>
        ) : (
          messages?.map((msg) => (
            <div key={msg.id} className="flex flex-col space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {msg.sender.first_name} {msg.sender.last_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(msg.created_at)}
                </span>
              </div>
              <p className="text-sm bg-muted p-3 rounded-lg">{msg.content}</p>
            </div>
          ))
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="min-h-[80px]"
        />
        <Button type="submit" size="icon" disabled={sendMessage.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
