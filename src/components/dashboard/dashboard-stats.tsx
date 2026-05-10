
"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, Loader2, CreditCard, Sparkles } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { ARLedgerModal } from "./ar-ledger-modal"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, Timestamp } from "firebase/firestore"

export function DashboardStats() {
  const { tenant } = useUser()
  const db = useFirestore()

  // 1. Receivables
  const clientsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return collection(db, "tenants", tenant.id, "b2bClients")
  }, [db, tenant?.id])

  const { data: clients, isLoading: isClientsLoading } = useCollection(clientsQuery)

  const totalReceivables = useMemo(() => {
    if (!clients) return 0
    return clients.reduce((sum, client) => sum + (client.outstandingBalance || 0), 0)
  }, [clients])

  // 2. Today's Sales - Stable for the current hour to prevent constant re-queries
  const todayTimestamp = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return Timestamp.fromDate(d)
  }, []) 

  const todaySalesQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      where("type", "==", "Sale"),
      where("createdAt", ">=", todayTimestamp)
    )
  }, [db, tenant?.id, todayTimestamp])

  const { data: todayTxs, isLoading: isTxsLoading } = useCollection(todaySalesQuery)

  const { totalTodaySales, totalTodayProfit } = useMemo(() => {
    if (!todayTxs) return { totalTodaySales: 0, totalTodayProfit: 0 }
    const sales = todayTxs.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0)
    const costs = todayTxs.reduce((sum, tx) => sum + (tx.totalCost || 0), 0)
    return { totalTodaySales: sales, totalTodayProfit: sales - costs }
  }, [todayTxs])

  // 3. Monthly Expenses - Stable for the session
  const monthTimestamp = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return Timestamp.fromDate(d)
  }, [])

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "expenses"),
      where("createdAt", ">=", monthTimestamp)
    )
  }, [db, tenant?.id, monthTimestamp])

  const { data: expenses, isLoading: isExpLoading } = useCollection(expensesQuery)

  const totalExpenses = useMemo(() => {
    if (!expenses) return 0
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  }, [expenses])

  const isLoading = isClientsLoading || isTxsLoading || isExpLoading

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-primary p-5 rounded-[32px] text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Wallet className="h-10 w-10" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Revenue Today</p>
          <p className="text-2xl font-black mt-2 tracking-tighter">
            {isLoading ? "..." : formatCurrency(totalTodaySales)}
          </p>
          <div className="flex items-center gap-1 text-[8px] font-black mt-3 uppercase tracking-widest">
            <TrendingUp className="h-3 w-3" /> {todayTxs?.length || 0} Orders
          </div>
        </div>

        <div className="bg-accent p-5 rounded-[32px] text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Sparkles className="h-10 w-10" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Gross Profit</p>
          <p className="text-2xl font-black mt-2 tracking-tighter">
            {isLoading ? "..." : formatCurrency(totalTodayProfit)}
          </p>
          <div className="flex items-center gap-1 text-[8px] font-black mt-3 uppercase tracking-widest">
            <ArrowUpRight className="h-3 w-3" /> Net Margin
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm">
          <div className="h-10 w-10 bg-destructive/5 text-destructive rounded-2xl flex items-center justify-center mb-3">
            <TrendingDown className="h-5 w-5" />
          </div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Expenses</p>
          <p className="text-xl font-black mt-1 tracking-tighter">
            {isLoading ? "..." : formatCurrency(totalExpenses)}
          </p>
          <p className="text-[8px] font-black text-muted-foreground/60 uppercase mt-2 tracking-widest">Monthly Total</p>
        </div>

        <ARLedgerModal>
          <button 
            id="receivables-ledger-btn"
            name="receivables-ledger-btn"
            className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm text-left h-full w-full"
          >
            <div className="h-10 w-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-3">
              <CreditCard className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Receivables</p>
            <p className="text-xl font-black mt-1 tracking-tighter">
              {isLoading ? "..." : formatCurrency(totalReceivables)}
            </p>
            <p className="text-[8px] font-black text-purple-600/60 uppercase mt-2 tracking-widest">Ledger Balance</p>
          </button>
        </ARLedgerModal>
      </div>
    </div>
  )
}
