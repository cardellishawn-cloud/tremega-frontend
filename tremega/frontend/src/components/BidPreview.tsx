import { useNavigate, useParams } from "react-router-dom"
import { useGetBid, useSendBid, useAcceptBid, useRejectBid } from "@/hooks/useBids"
import { BidStatusBadge } from "./BidStatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowLeft, Send, Check, X, Pencil } from "lucide-react"

export function BidPreview() {
  const navigate = useNavigate()
  const { id } = useParams()
  
  const { data: bid, isLoading, error } = useGetBid(id || "")
  const sendBid = useSendBid()
  const acceptBid = useAcceptBid()
  const rejectBid = useRejectBid()

  const handleSend = async () => {
    if (!id) return
    try {
      await sendBid.mutateAsync(id)
    } catch (error) {
      console.error("Failed to send bid:", error)
    }
  }

  const handleAccept = async () => {
    if (!id) return
    try {
      await acceptBid.mutateAsync(id)
    } catch (error) {
      console.error("Failed to accept bid:", error)
    }
  }

  const handleReject = async () => {
    if (!id) return
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
          <div className="text-muted-foreground">Loading bid...</div>
        </CardContent>
      </Card>
    )
  }

  if (error || !bid) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-destructive">Error loading bid. Please try again.</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/bids")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-2xl">{bid.title}</CardTitle>
                <p className="text-muted-foreground mt-1">
                  Created {formatDate(bid.created_at)}
                </p>
              </div>
            </div>
            <BidStatusBadge 
              status={bid.status} 
              daysUntilExpiration={bid.daysUntilExpiration}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Customer</h3>
              <div className="text-muted-foreground">
                <p className="font-medium text-foreground">{bid.customer_name}</p>
                {bid.customer_email && <p>{bid.customer_email}</p>}
                {bid.customer_phone && <p>{bid.customer_phone}</p>}
                {bid.job_address && <p>{bid.job_address}</p>}
              </div>
            </div>
            
            <div className="text-right">
              <h3 className="font-semibold mb-2">Bid Details</h3>
              <div className="text-muted-foreground space-y-1">
                <p>Status: <BidStatusBadge status={bid.status} daysUntilExpiration={bid.daysUntilExpiration} /></p>
                {bid.sent_at && <p>Sent: {formatDate(bid.sent_at)}</p>}
                {bid.expires_at && bid.status === 'sent' && (
                  <p>Expires: {formatDate(bid.expires_at)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h3 className="font-semibold mb-4">Line Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-right p-3 font-medium">Qty</th>
                    <th className="text-right p-3 font-medium">Unit Price</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bid.line_items?.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="p-3 text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatCurrency(bid.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({bid.tax_rate}%):</span>
                <span>{formatCurrency(bid.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(bid.total)}</span>
              </div>
            </div>
          </div>

          {/* Description/Notes */}
          {bid.description && (
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{bid.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            {bid.status === 'draft' && (
              <>
                <Button variant="outline" onClick={() => navigate(`/bids/${bid.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={handleSend} disabled={sendBid.isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  {sendBid.isPending ? "Sending..." : "Send to Customer"}
                </Button>
              </>
            )}
            
            {bid.status === 'sent' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleReject} 
                  disabled={rejectBid.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="mr-2 h-4 w-4" />
                  {rejectBid.isPending ? "Rejecting..." : "Reject"}
                </Button>
                <Button 
                  onClick={handleAccept} 
                  disabled={acceptBid.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="mr-2 h-4 w-4" />
                  {acceptBid.isPending ? "Accepting..." : "Accept Bid"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
