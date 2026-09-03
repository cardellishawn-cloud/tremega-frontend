import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SubscriptionStatus } from "@/components/SubscriptionStatus"

export function ProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Full Name</div>
              <div className="font-medium">{user.full_name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="font-medium">{user.email}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Role</div>
              <Badge variant="secondary" className="capitalize">
                {user.role}
              </Badge>
            </div>
            {user.company_name && (
              <div>
                <div className="text-sm text-muted-foreground">Company</div>
                <div className="font-medium">{user.company_name}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <SubscriptionStatus />
      </div>
    </div>
  )
}
