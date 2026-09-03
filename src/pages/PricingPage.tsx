import { useGetPlans, useCreateCheckout, useGetSubscription } from "@/hooks/useBilling"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2 } from "lucide-react"

export function PricingPage() {
  const { data: plans, isLoading: plansLoading } = useGetPlans()
  const { data: subscription } = useGetSubscription()
  const createCheckout = useCreateCheckout()

  const handleSubscribe = async (priceId: string) => {
    try {
      const { url } = await createCheckout.mutateAsync(priceId)
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error("Failed to create checkout:", error)
    }
  }

  const currentPlan = subscription?.plan_tier
  const isActive = subscription?.status === 'active'

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-8">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl font-bold mb-3">Choose Your Plan</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Start winning more bids with professional estimates and photo documentation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {plans?.map((plan) => {
          const isCurrent = isActive && currentPlan === plan.id
          const isPro = plan.id === 'pro'

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isPro ? 'border-[#3B2F8A] border-2 shadow-lg' : ''
              } ${isCurrent ? 'ring-2 ring-green-500' : ''}`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[#3B2F8A] text-white px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <Badge className="bg-green-600 text-white px-3 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan.priceId)}
                  disabled={isCurrent || createCheckout.isPending}
                  className={`w-full min-h-[44px] ${
                    isPro
                      ? 'bg-[#3B2F8A] hover:bg-[#2F2570]'
                      : ''
                  }`}
                  variant={isCurrent ? 'outline' : isPro ? 'default' : 'outline'}
                >
                  {createCheckout.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isCurrent
                    ? 'Current Plan'
                    : createCheckout.isPending
                      ? 'Loading...'
                      : `Subscribe to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-8">
        All plans include a 14-day free trial. Cancel anytime.
      </p>
    </div>
  )
}
