
"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, Loader2, CreditCard } from "lucide-react"
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

  // 2. Today's Sales
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayTimestamp = Timestamp.fromDate(startOfToday)

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

  // 3. Monthly Expenses
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0,0,0,0)
  const monthTimestamp = Timestamp.fromDate(startOfMonth)

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "expenses"),
      where("createdAt", ">=", monthTimestamp)
    )
  }, [db, tenant?.id])

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
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Sales Today</p>
          <p className="text-2xl font-black mt-2 tracking-tighter">
            {isLoading ? "..." : formatCurrency(totalTodaySales)}
          </p>
          <div className="flex items-center gap-1 text-[8px] font-black mt-3 uppercase tracking-widest">
            <TrendingUp className="h-3 w-3" /> {todayTxs?.length || 0} Orders
          </div>
        </div>

        <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm">
          <div className="h-10 w-10 bg-destructive/5 text-destructive rounded-2xl flex items-center justify-center mb-3">
            <CreditCard className="h-5 w-5" />
          </div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Month Burn</p>
          <p className="text-xl font-black mt-1 tracking-tighter">
            {isLoading ? "..." : formatCurrency(totalExpenses)}
          </p>
        </div>
      </div>

      <ARLedgerModal>
        <button className="w-full bg-accent/5 border-2 border-accent/10 p-6 rounded-[32px] flex items-center justify-between active:scale-[0.98] transition-all">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-accent rounded-2xl flex items-center justify-center text-white">
              <ArrowUpRight className="h-6 w-6" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-accent uppercase tracking-widest leading-none">Total Receivables</p>
              <p className="text-xl font-black mt-1 tracking-tighter text-foreground">{formatCurrency(totalReceivables)}</p>
            </div>
          </div>
          <div className="h-10 px-4 bg-accent/10 rounded-full flex items-center justify-center">
            <span className="text-[10px] font-black text-accent uppercase tracking-widest">Ledger</span>
          </div>
        </button>
      </ARLedgerModal>
    </div>
  )
}
