
"use client"

import { TrendingUp, TrendingDown, Wallet, Package, ArrowUpRight } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { ARLedgerModal } from "./ar-ledger-modal"

export function DashboardStats() {
  const stats = [
    {
      label: "Today's Sales",
      value: 12450.00,
      change: "+12.5%",
      isPositive: true,
      icon: Wallet,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Receivables",
      value: 25920.50,
      change: "3 Clients",
      isPositive: true,
      icon: ArrowUpRight,
      color: "bg-orange-50 text-orange-600",
      isAR: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        const content = (
          <div key={stat.label} className={cn(
            "bg-card p-4 rounded-3xl shadow-sm border-none relative overflow-hidden group cursor-pointer active:scale-95 transition-all",
            stat.isAR && "ring-2 ring-primary/5"
          )}>
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", stat.color)}>
              <Icon className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
            <p className="text-lg font-black mt-1">{formatCurrency(stat.value)}</p>
            <div className={cn(
              "flex items-center gap-1 text-[10px] mt-2 font-bold",
              stat.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {stat.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {stat.change}
            </div>
          </div>
        )

        return stat.isAR ? (
          <ARLedgerModal key={stat.label}>
            {content}
          </ARLedgerModal>
        ) : content
      })}
    </div>
  )
}
