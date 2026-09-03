import { useAuth } from "@/context/AuthContext"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Users, Briefcase } from "lucide-react"

export function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  const stats = [
    { label: "Total Bids", value: "—", icon: FileText },
    { label: "Total Subs", value: "—", icon: Users },
    { label: "Pending Jobs", value: "—", icon: Briefcase },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Welcome, {user.full_name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="capitalize">
              {user.role}
            </Badge>
            {user.company_name && (
              <span className="text-muted-foreground text-sm">
                {user.company_name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/dashboard/bids" className="block p-4 rounded-md hover:bg-accent active:bg-accent/80 transition-colors min-h-[44px]">
              <div className="font-medium">View Bids</div>
              <div className="text-sm text-muted-foreground">Manage your bids and estimates</div>
            </Link>
            <Link to="/dashboard/subs" className="block p-4 rounded-md hover:bg-accent active:bg-accent/80 transition-colors min-h-[44px]">
              <div className="font-medium">View Subs</div>
              <div className="text-sm text-muted-foreground">Manage subcontractors</div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No recent activity to display.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}