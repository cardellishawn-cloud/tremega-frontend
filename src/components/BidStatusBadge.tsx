import { Badge } from "@/components/ui/badge"
import type { BidStatus } from "@/types"
import { cn } from "@/lib/utils"

interface BidStatusBadgeProps {
  status: BidStatus
  daysUntilExpiration?: number | null
  className?: string
}

const statusConfig: Record<BidStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-500 hover:bg-gray-600" },
  sent: { label: "Sent", className: "bg-blue-500 hover:bg-blue-600" },
  accepted: { label: "Accepted", className: "bg-green-500 hover:bg-green-600" },
  rejected: { label: "Rejected", className: "bg-red-500 hover:bg-red-600" },
  expired: { label: "Expired", className: "bg-orange-500 hover:bg-orange-600" },
}

export function BidStatusBadge({ status, daysUntilExpiration, className }: BidStatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge className={cn("text-white", config.className)}>
        {config.label}
      </Badge>
      {status === 'sent' && daysUntilExpiration !== null && daysUntilExpiration !== undefined && (
        <span className={cn(
          "text-xs",
          daysUntilExpiration <= 3 ? "text-red-500 font-medium" : "text-muted-foreground"
        )}>
          {daysUntilExpiration === 0 
            ? "Expires today" 
            : daysUntilExpiration === 1 
              ? "1 day left" 
              : `${daysUntilExpiration} days left`}
        </span>
      )}
    </div>
  )
}
