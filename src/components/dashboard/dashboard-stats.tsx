import { TrendingUp, TrendingDown, DollarSign, Package } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardStats() {
  const stats = [
    {
      label: "Total Sales",
      value: "$12,450",
      change: "+12.5%",
      isPositive: true,
      icon: DollarSign,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Inventory",
      value: "152 items",
      change: "-2 units",
      isPositive: false,
      icon: Package,
      color: "bg-purple-50 text-purple-600",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div key={stat.label} className="bg-card p-4 rounded-2xl shadow-sm border-none relative overflow-hidden group">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center mb-3", stat.color)}>
              <Icon className="h-6 w-6" />
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-bold mt-1">{stat.value}</p>
            <div className={cn(
              "flex items-center gap-1 text-[10px] mt-2 font-bold",
              stat.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {stat.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {stat.change}
            </div>
          </div>
        )
      })}
    </div>
  )
}
