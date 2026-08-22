import { useState } from "react"
import { useInviteSub } from "@/hooks/useSubs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface InviteSubModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
}

export function InviteSubModal({ open, onOpenChange, businessId }: InviteSubModalProps) {
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [success, setSuccess] = useState(false)
  
  const inviteSub = useInviteSub()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await inviteSub.mutateAsync({
        email,
        firstName,
        lastName,
        businessId,
      })
      setSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        setSuccess(false)
        setEmail("")
        setFirstName("")
        setLastName("")
      }, 2000)
    } catch (error) {
      console.error("Failed to invite sub:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Subcontractor</DialogTitle>
          <DialogDescription>
            Send an invitation to a subcontractor to join your business.
          </DialogDescription>
        </DialogHeader>
        
        {success ? (
          <div className="py-6 text-center">
            <div className="text-green-600 font-medium text-lg mb-2">
              Invitation Sent!
            </div>
            <p className="text-muted-foreground">
              An invitation has been sent to {email}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sub@example.com"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name *</label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name *</label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteSub.isPending}>
                {inviteSub.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
