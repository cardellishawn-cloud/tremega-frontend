import { useState } from "react"
import { useGetMyAssignments, useStartAssignment, useCompleteAssignment } from "@/hooks/useSubAssignments"
import { useGetMessages, useSendMessage } from "@/hooks/useMessages"
import { useGetPhotos, useUploadPhoto } from "@/hooks/usePhotos"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Play, Check, MessageSquare, Camera, Send } from "lucide-react"

const BUSINESS_ID = "biz-1" // TODO: Get from auth context

export function SubDashboard() {
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPhase, setPhotoPhase] = useState("progress")
  const [photoDescription, setPhotoDescription] = useState("")
  
  const { data: assignments, isLoading } = useGetMyAssignments()
  const startAssignment = useStartAssignment()
  const completeAssignment = useCompleteAssignment()
  
  const { data: messages } = useGetMessages({ 
    businessId: BUSINESS_ID, 
    subAssignmentId: selectedAssignment || undefined 
  })
  const sendMessage = useSendMessage()
  
  const { data: photos } = useGetPhotos({ 
    businessId: BUSINESS_ID, 
    bidId: selectedAssignment ? undefined : undefined // TODO: Get bidId from assignment
  })
  const uploadPhoto = useUploadPhoto()

  const handleStart = async (id: string) => {
    try {
      await startAssignment.mutateAsync(id)
    } catch (error) {
      console.error("Failed to start assignment:", error)
    }
  }

  const handleComplete = async (id: string) => {
    try {
      await completeAssignment.mutateAsync(id)
    } catch (error) {
      console.error("Failed to complete assignment:", error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !selectedAssignment) return
    
    try {
      await sendMessage.mutateAsync({
        content: message,
        businessId: BUSINESS_ID,
        subAssignmentId: selectedAssignment,
      })
      setMessage("")
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoFile || !selectedAssignment) return
    
    try {
      await uploadPhoto.mutateAsync({
        file: photoFile,
        businessId: BUSINESS_ID,
        phase: photoPhase,
        description: photoDescription,
      })
      setPhotoFile(null)
      setPhotoDescription("")
    } catch (error) {
      console.error("Failed to upload photo:", error)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      assigned: "secondary",
      started: "default",
      completed: "outline",
    }
    return <Badge variant={variants[status] || "default"}>{status}</Badge>
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <div className="text-muted-foreground">Loading your assignments...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">My Assignments</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignments List */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Work</CardTitle>
          </CardHeader>
          <CardContent>
            {assignments?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No assignments yet. You'll see your work here when assigned.
              </div>
            ) : (
              <div className="space-y-4">
                {assignments?.map((assignment) => (
                  <div 
                    key={assignment.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedAssignment === assignment.id ? 'border-primary bg-accent' : ''
                    }`}
                    onClick={() => setSelectedAssignment(assignment.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{assignment.lineItem.description}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {assignment.lineItem.type} • {assignment.lineItem.quantity} {assignment.lineItem.unit}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Assigned {formatDate(assignment.assignedDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(assignment.lineItem.total)}</p>
                        {getStatusBadge(assignment.status)}
                      </div>
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                      {assignment.status === 'assigned' && (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStart(assignment.id)
                          }}
                          disabled={startAssignment.isPending}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Start Work
                        </Button>
                      )}
                      {assignment.status === 'started' && (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleComplete(assignment.id)
                          }}
                          disabled={completeAssignment.isPending}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages & Photos */}
        <div className="space-y-6">
          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedAssignment ? (
                <div className="text-center py-8 text-muted-foreground">
                  Select an assignment to view messages
                </div>
              ) : (
                <>
                  <div className="space-y-4 max-h-64 overflow-y-auto mb-4">
                    {messages?.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        No messages yet
                      </div>
                    ) : (
                      messages?.map((msg) => (
                        <div key={msg.id} className="border-b pb-2 last:border-0">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-sm">
                              {msg.sender.first_name} {msg.sender.last_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{msg.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="min-h-[60px]"
                    />
                    <Button type="submit" size="icon" disabled={sendMessage.isPending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          {/* Photo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Upload Photo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedAssignment ? (
                <div className="text-center py-8 text-muted-foreground">
                  Select an assignment to upload photos
                </div>
              ) : (
                <form onSubmit={handleUploadPhoto} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Photo</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Phase</label>
                    <Select value={photoPhase} onChange={(e) => setPhotoPhase(e.target.value)}>
                      <option value="bid">Bid</option>
                      <option value="progress">Progress</option>
                      <option value="completion">Completion</option>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Description (optional)</label>
                    <Input
                      value={photoDescription}
                      onChange={(e) => setPhotoDescription(e.target.value)}
                      placeholder="Photo description..."
                    />
                  </div>
                  
                  <Button type="submit" disabled={!photoFile || uploadPhoto.isPending}>
                    {uploadPhoto.isPending ? "Uploading..." : "Upload Photo"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
