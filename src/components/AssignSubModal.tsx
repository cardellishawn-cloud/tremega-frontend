import { useState } from "react"
import { useGetSubs } from "@/hooks/useSubs"
import { useAssignSubToLineItem } from "@/hooks/useSubAssignments"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserPlus, Check, AlertCircle } from "lucide-react"

interface AssignSubModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bidId: string
  lineItemId: string
  lineItemDescription: string
  businessId: string
  assignedSubId?: string | null
  assignedSubName?: string | null
}

export function AssignSubModal({
  open,
  onOpenChange,
  bidId,
  lineItemId,
  lineItemDescription,
  businessId,
  assignedSubId,
  assignedSubName,
}: AssignSubModalProps) {
  const [selectedSub, setSelectedSub] = useState("")
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: subs, isLoading: subsLoading } = useGetSubs(businessId)
  const assignSub = useAssignSubToLineItem()

  const activeSubs = subs?.filter((s) => s.status === "active") || []

  // If already assigned, show the assigned sub name
  const isAlreadyAssigned = !!assignedSubId

  const handleAssign = async () => {
    if (!selectedSub) return
    setError(null)

    // Debug: log exactly what we're sending
    const payload = { bidId, lineItemId, subUserId: selectedSub }
    console.log('[AssignSubModal] Sending payload:', JSON.stringify(payload))
    console.log('[AssignSubModal] selectedSub value:', selectedSub, '| type:', typeof selectedSub, '| length:', selectedSub?.length)
    console.log('[AssignSubModal] Available subs:', activeSubs.map(s => ({ id: s.id, name: s.name })))

    try {
      await assignSub.mutateAsync({
        bidId,
        lineItemId,
        subUserId: selectedSub,
      })
      setSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        setSuccess(false)
        setSelectedSub("")
      }, 1500)
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || "Failed to assign sub. Please try again."
      setError(msg)
    }
  }

  const handleClose = () => {
    if (!assignSub.isPending) {
      onOpenChange(false)
      setSelectedSub("")
      setError(null)
      setSuccess(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Subcontractor</DialogTitle>
          <DialogDescription>
            Assign a subcontractor to: <strong>{lineItemDescription}</strong>
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <div className="text-green-600 font-medium text-lg mb-2">
              Sub Assigned Successfully!
            </div>
            <p className="text-muted-foreground">
              An SMS notification has been sent to the subcontractor.
            </p>
          </div>
        ) : isAlreadyAssigned ? (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Currently assigned:</span>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                {assignedSubName || "Unknown Sub"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              This line item already has a subcontractor assigned. To reassign,
              select a different sub below.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reassign to:</label>
              <Select
                value={selectedSub}
                onChange={(e) => setSelectedSub(e.target.value)}
                disabled={subsLoading}
              >
                <option value="">
                  {subsLoading ? "Loading subs..." : "Select a sub..."}
                </option>
                {activeSubs.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} — {sub.skills?.join(", ") || "General"}
                  </option>
                ))}
              </Select>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedSub || assignSub.isPending}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {assignSub.isPending ? "Reassigning..." : "Reassign"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Select Subcontractor *
              </label>
              <Select
                value={selectedSub}
                onChange={(e) => setSelectedSub(e.target.value)}
                disabled={subsLoading}
              >
                <option value="">
                  {subsLoading ? "Loading subs..." : "Select a sub..."}
                </option>
                {activeSubs.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} — {sub.skills?.join(", ") || "General"}
                  </option>
                ))}
              </Select>
            </div>

            {activeSubs.length === 0 && !subsLoading && (
              <p className="text-sm text-muted-foreground">
                No active subcontractors found. Invite subs from the Subs page
                first.
              </p>
            )}

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedSub || assignSub.isPending}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {assignSub.isPending ? "Assigning..." : "Assign Sub"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
