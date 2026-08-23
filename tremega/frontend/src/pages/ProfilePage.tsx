import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      <Card className="max-w-lg">
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
    </div>
  )
}
