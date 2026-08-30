import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useGetBids, useDeleteBid, useSendBid, useAcceptBid, useRejectBid } from "@/hooks/useBids"
import { BidStatusBadge } from "./BidStatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Bid, BidStatus } from "@/types"
import { Eye, Pencil, Send, Check, X, Trash2, Plus } from "lucide-react"

interface BidsListProps {
  initialStatusFilter?: BidStatus
}

export function BidsList({ initialStatusFilter }: BidsListProps) {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<BidStatus | "all">(initialStatusFilter || "all")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  const { data: bidsResponse, isLoading, error } = useGetBids(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  )
  
  // Debug logging to understand the API response
  console.log('Bids API Response:', bidsResponse)
  console.log('Is Array:', Array.isArray(bidsResponse))
  console.log('Type:', typeof bidsResponse)
  
  // Ensure bids is always an array
  const bids = Array.isArray(bidsResponse) ? bidsResponse : []
  
  const deleteBid = useDeleteBid()
  const sendBid = useSendBid()
  const acceptBid = useAcceptBid()
  const rejectBid = useRejectBid()

  const handleDelete = async (id: string) => {
    try {
      await deleteBid.mutateAsync(id)
      setDeleteConfirm(null)
    } catch (error) {
      console.error("Failed to delete bid:", error)
    }
  }

  const handleSend = async (id: string) => {
    try {
      await sendBid.mutateAsync(id)
    } catch (error) {
      console.error("Failed to send bid:", error)
    }
  }

  const handleAccept = async (id: string) => {
    try {
      await acceptBid.mutateAsync(id)
    } catch (error) {
      console.error("Failed to accept bid:", error)
    }
  }

  const handleReject = async (id: string) => {
    try {
      await rejectBid.mutateAsync(id)
    } catch (error) {
      console.error("Failed to reject bid:", error)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-muted-foreground">Loading bids...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    // If it's a 404 error (endpoint not found), show empty state instead of error
    if (error.message?.includes('404') || error.message?.includes('Not Found')) {
      return (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bids & Estimates</CardTitle>
            <div className="flex items-center gap-4">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as BidStatus | "all")}
                className="w-[150px]"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </Select>
              <Button onClick={() => navigate("/dashboard/bids/new")}>
                <Plus className="mr-2 h-4 w-4" />
                New Bid
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-10 text-muted-foreground">
              <p className="mb-4">Bids feature is not yet implemented on the backend.</p>
              <p className="text-sm">The bids API endpoint needs to be created.</p>
            </div>
          </CardContent>
        </Card>
      )
    }
    
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-destructive">Error loading bids. Please try again.</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bids & Estimates</CardTitle>
          <div className="flex items-center gap-4">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BidStatus | "all")}
              className="w-[150px]"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </Select>
            <Button onClick={() => navigate("/dashboard/bids/new")}>
              <Plus className="mr-2 h-4 w-4" />
              New Bid
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bids?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No bids found. Create your first bid to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids?.map((bid: Bid) => (
                  <TableRow key={bid.id}>
                    <TableCell className="font-medium">{bid.title}</TableCell>
                    <TableCell>{bid.customer_name || "Unknown"}</TableCell>
                    <TableCell>
                      <BidStatusBadge 
                        status={bid.status} 
                        daysUntilExpiration={bid.daysUntilExpiration}
                      />
                    </TableCell>
                    <TableCell>{formatCurrency(bid.total)}</TableCell>
                    <TableCell>
                      {bid.status === 'sent' && bid.expires_at ? formatDate(bid.expires_at) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/dashboard/bids/${bid.id}`)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {bid.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/dashboard/bids/${bid.id}/edit`)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSend(bid.id)}
                              disabled={sendBid.isPending}
                              title="Send"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm(bid.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        
                        {bid.status === 'sent' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAccept(bid.id)}
                              disabled={acceptBid.isPending}
                              title="Accept"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReject(bid.id)}
                              disabled={rejectBid.isPending}
                              title="Reject"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bid</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bid? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteBid.isPending}
            >
              {deleteBid.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
