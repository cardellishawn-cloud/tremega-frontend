import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useGetSubscription } from "@/hooks/useBilling"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  CreditCard, 
  Download, 
  Search, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  FileText
} from "lucide-react"

interface Payment {
  id: string
  date: string
  amount: number
  description: string
  status: 'completed' | 'pending' | 'failed' | 'refunded'
  invoiceNumber: string
  type: 'subscription' | 'one-time'
}

export function PaymentHistory() {
  const { user } = useAuth()
  const { data: subscription } = useGetSubscription()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<string>("all")

  if (!user) return null

  // Mock payment data - would come from Stripe API
  const payments: Payment[] = [
    {
      id: '1',
      date: new Date().toISOString(),
      amount: 99,
      description: 'Pro Plan Subscription',
      status: 'completed',
      invoiceNumber: 'INV-2024-001',
      type: 'subscription'
    },
    {
      id: '2',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      amount: 99,
      description: 'Pro Plan Subscription',
      status: 'completed',
      invoiceNumber: 'INV-2024-002',
      type: 'subscription'
    },
  ]

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    // Search filter
    if (searchQuery && !payment.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !payment.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    
    // Status filter
    if (statusFilter !== 'all' && payment.status !== statusFilter) {
      return false
    }
    
    // Date filter
    if (dateRange !== 'all') {
      const paymentDate = new Date(payment.date)
      const now = new Date()
      switch (dateRange) {
        case 'month':
          if (paymentDate.getMonth() !== now.getMonth() || paymentDate.getFullYear() !== now.getFullYear()) {
            return false
          }
          break
        case '30days':
          if (paymentDate.getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000) {
            return false
          }
          break
      }
    }
    
    return true
  })

  const getStatusIcon = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'refunded':
        return <XCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: Payment['status']) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      refunded: 'bg-gray-100 text-gray-800',
    }
    return <Badge className={colors[status]}>{status}</Badge>
  }

  const handleDownloadInvoice = (payment: Payment) => {
    // TODO: Generate and download PDF invoice
    console.log('Downloading invoice:', payment.invoiceNumber)
    alert(`Invoice ${payment.invoiceNumber} download started`)
  }

  const totalSpent = filteredPayments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Payment History</h1>
          <p className="text-muted-foreground mt-1">
            View and download your invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">Total: ${totalSpent}</span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice # or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
              >
                Completed
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('pending')}
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === 'failed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('failed')}
              >
                Failed
              </Button>
            </div>

            {/* Date Filter */}
            <div className="flex gap-2">
              <Button
                variant={dateRange === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('all')}
              >
                <Calendar className="mr-2 h-4 w-4" />
                All Time
              </Button>
              <Button
                variant={dateRange === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('month')}
              >
                This Month
              </Button>
              <Button
                variant={dateRange === '30days' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('30days')}
              >
                Last 30 Days
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Subscription */}
      {subscription && subscription.plan_tier && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-lg capitalize">
                  {subscription.plan_tier} Plan
                </div>
                <Badge className={subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {subscription.status}
                </Badge>
              </div>
              {subscription.current_period_end && (
                <div className="text-sm text-muted-foreground">
                  Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length > 0 ? (
            <div className="space-y-4">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(payment.status)}
                    <div>
                      <div className="font-medium">{payment.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {payment.invoiceNumber} • {new Date(payment.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold">${payment.amount}</div>
                      {getStatusBadge(payment.status)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadInvoice(payment)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Invoice
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payments found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
