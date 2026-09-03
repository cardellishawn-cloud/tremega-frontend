import { useGetSubscription, useCancelSubscription } from "@/hooks/useBilling"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Calendar, AlertTriangle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useState } from "react"

export function SubscriptionStatus() {
  const { data: subscription, isLoading } = useGetSubscription()
  const cancelSubscription = useCancelSubscription()
  const navigate = useNavigate()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-muted-foreground text-sm">Loading subscription...</div>
        </CardContent>
      </Card>
    )
  }

  const planTier = subscription?.plan_tier
  const status = subscription?.status || 'none'
  const periodEnd = subscription?.current_period_end
  const cancelAtEnd = subscription?.cancel_at_period_end

  const planNames: Record<string, string> = {
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    canceled: 'bg-red-100 text-red-800',
    none: 'bg-gray-100 text-gray-800',
  }

  const handleCancel = async () => {
    try {
      await cancelSubscription.mutateAsync()
      setShowCancelConfirm(false)
    } catch (error) {
      console.error('Failed to cancel:', error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {planTier && status === 'active' ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{planNames[planTier] || planTier}</div>
                <Badge className={`mt-1 ${statusColors[status] || statusColors.none}`}>
                  {cancelAtEnd ? 'Cancels at period end' : status}
                </Badge>
              </div>
            </div>

            {periodEnd && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {cancelAtEnd ? 'Access until' : 'Renews'}{' '}
                {new Date(periodEnd).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            )}

            {!cancelAtEnd && (
              <div className="pt-2 border-t">
                {showCancelConfirm ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>Your plan will remain active until the end of the billing period.</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCancelConfirm(false)}
                      >
                        Keep Plan
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleCancel}
                        disabled={cancelSubscription.isPending}
                      >
                        {cancelSubscription.isPending ? 'Cancelling...' : 'Confirm Cancel'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Cancel subscription
                  </Button>
                )}
              </div>
            )}
          </>
        ) : status === 'past_due' ? (
          <div className="space-y-3">
            <Badge className={statusColors.past_due}>Payment Past Due</Badge>
            <p className="text-sm text-muted-foreground">
              Your payment failed. Please update your payment method to continue your subscription.
            </p>
            <Button size="sm" onClick={() => navigate('/pricing')}>
              Update Payment
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You're on the free plan. Upgrade to unlock all features.
            </p>
            <Button size="sm" onClick={() => navigate('/pricing')}>
              View Plans
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
