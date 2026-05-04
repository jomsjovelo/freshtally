
"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, Loader2 } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { ARLedgerModal } from "./ar-ledger-modal"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, Timestamp } from "firebase/firestore"

export function DashboardStats() {
  const { tenant } = useUser()
  const db = useFirestore()

  // 1. Calculate Receivables from B2B Clients
  const clientsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return collection(db, "tenants", tenant.id, "b2bClients")
  }, [db, tenant?.id])

  const { data: clients, isLoading: isClientsLoading } = useCollection(clientsQuery)

  const totalReceivables = useMemo(() => {
    if (!clients) return 0
    return clients.reduce((sum, client) => sum + (client.outstandingBalance || 0), 0)
  }, [clients])

  // 2. Calculate Today's Sales
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTimestamp = Timestamp.fromDate(today)

  const todaySalesQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      where("type", "==", "Sale"),
      where("createdAt", ">=", todayTimestamp)
    )
  }, [db, tenant?.id])

  const { data: todayTxs, isLoading: isTxsLoading } = useCollection(todaySalesQuery)

  const totalTodaySales = useMemo(() => {
    if (!todayTxs) return 0
    return todayTxs.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0)
  }, [todayTxs])

  const isLoading = isClientsLoading || isTxsLoading

  const stats = [
    {
      label: "Today's Sales",
      value: totalTodaySales,
      change: todayTxs?.length ? `${todayTxs.length} TXs` : "No activity",
      isPositive: true,
      icon: Wallet,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Receivables",
      value: totalReceivables,
      change: clients?.length ? `${clients.filter(c => c.outstandingBalance > 0).length} Clients` : "0 Clients",
      isPositive: totalReceivables > 0,
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
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-6 w-6" />}
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
            <p className="text-lg font-black mt-1">
              {isLoading ? "..." : formatCurrency(stat.value)}
            </p>
            <div className={cn(
              "flex items-center gap-1 text-[10px] mt-2 font-bold",
              stat.isPositive ? "text-green-600" : "text-muted-foreground"
            )}>
              {!isLoading && stat.isPositive && <TrendingUp className="h-3 w-3" />}
              {isLoading ? "Syncing..." : stat.change}
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
