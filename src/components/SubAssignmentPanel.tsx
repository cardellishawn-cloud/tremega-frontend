import { useState } from "react"
import { useGetSubs } from "@/hooks/useSubs"
import { useAssignSubToLineItem } from "@/hooks/useSubAssignments"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Check } from "lucide-react"

interface SubAssignmentPanelProps {
  bidId: string
  lineItemId: string
  lineItemDescription: string
  businessId: string
  assignedSub?: {
    id: string
    name: string
    status: string
  }
}

export function SubAssignmentPanel({ 
  bidId, 
  lineItemId, 
  lineItemDescription, 
  businessId,
  assignedSub 
}: SubAssignmentPanelProps) {
  const [selectedSub, setSelectedSub] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)
  
  const { data: subs } = useGetSubs(businessId)
  const assignSub = useAssignSubToLineItem()

  const activeSubs = subs?.filter(s => s.status === 'active') || []

  const handleAssign = async () => {
    if (!selectedSub) return
    
    setIsAssigning(true)
    try {
      await assignSub.mutateAsync({
        bidId,
        lineItemId,
        subUserId: selectedSub,
      })
      setSelectedSub("")
    } catch (error) {
      console.error("Failed to assign sub:", error)
    } finally {
      setIsAssigning(false)
    }
  }

  if (assignedSub) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="secondary" className="flex items-center gap-1">
          <Check className="h-3 w-3" />
          Assigned to {assignedSub.name}
        </Badge>
        <span className="text-muted-foreground capitalize">({assignedSub.status})</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedSub}
        onChange={(e) => setSelectedSub(e.target.value)}
        className="w-[200px]"
      >
        <option value="">Select a sub...</option>
        {activeSubs.map((sub) => (
          <option key={sub.id} value={sub.id}>
            {sub.name}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        onClick={handleAssign}
        disabled={!selectedSub || isAssigning || assignSub.isPending}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        {isAssigning ? "Assigning..." : "Assign"}
      </Button>
    </div>
  )
}
