import { useState } from "react"
import { useGetSubs, useRemoveSub } from "@/hooks/useSubs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { InviteSubModal } from "./InviteSubModal"
import { SubPerformanceDashboard } from "./SubPerformanceDashboard"
import { formatCurrency } from "@/lib/utils"
import { Plus, Eye, Trash2, Mail, Phone } from "lucide-react"

const BUSINESS_ID = "biz-1" // TODO: Get from auth context

export function SubsList() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedSub, setSelectedSub] = useState<string | null>(null)
  
  const { data: subs, isLoading, error } = useGetSubs(BUSINESS_ID)
  const removeSub = useRemoveSub()

  const filteredSubs = subs?.filter(sub => 
    statusFilter === "all" || sub.status === statusFilter
  )

  const handleRemove = async (id: string) => {
    try {
      await removeSub.mutateAsync({ id, businessId: BUSINESS_ID })
      setDeleteConfirm(null)
    } catch (error) {
      console.error("Failed to remove sub:", error)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-muted-foreground">Loading subs...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-destructive">Error loading subs. Please try again.</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Subcontractors</CardTitle>
          <div className="flex items-center gap-4">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-[150px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="invited">Invited</option>
            </Select>
            <Button onClick={() => setInviteModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Sub
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSubs?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No subs found. Invite your first subcontractor to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completion Rate</TableHead>
                  <TableHead>Avg Turnaround</TableHead>
                  <TableHead>Total Jobs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubs?.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          {sub.email}
                        </div>
                        {sub.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {sub.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={sub.status === 'active' ? 'default' : sub.status === 'invited' ? 'secondary' : 'outline'}
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.rating != null ? (
                        <span className={sub.rating >= 4.5 ? "text-green-600 font-medium" : ""}>
                          {sub.rating.toFixed(1)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {sub.performance_score != null
                        ? `${sub.performance_score}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {sub.total_jobs_completed || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedSub(sub.id)}
                          title="View Performance"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(sub.id)}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InviteSubModal 
        open={inviteModalOpen} 
        onOpenChange={setInviteModalOpen}
        businessId={BUSINESS_ID}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Subcontractor</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this subcontractor? They will no longer have access to your business.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && handleRemove(deleteConfirm)}
              disabled={removeSub.isPending}
            >
              {removeSub.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSub} onOpenChange={() => setSelectedSub(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Subcontractor Performance</DialogTitle>
          </DialogHeader>
          {selectedSub && (
            <SubPerformanceDashboard subId={selectedSub} businessId={BUSINESS_ID} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
