
"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { Bell, ShoppingCart, Package, ShieldX, ShieldCheck, Megaphone, TrendingDown, Store, AlertCircle } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where } from "firebase/firestore"
import { Button } from "@/components/ui/button"

const RevenueChart = dynamic(() => import("@/components/dashboard/revenue-chart").then(mod => mod.RevenueChart), {
  ssr: false,
  loading: () => <div className="h-[180px] w-full bg-muted/20 animate-pulse rounded-2xl" />
})

const ExpenseAITool = dynamic(() => import("@/components/dashboard/expense-ai-tool").then(mod => mod.ExpenseAITool), {
  ssr: false,
  loading: () => <div className="h-40 w-full bg-muted/10 animate-pulse rounded-2xl" />
})

export default function DashboardPage() {
  const { profile, tenant, isUserLoading, user } = useUser()
  const router = useRouter()
  const db = useFirestore()
  const [stableNow, setStableNow] = useState<string | null>(null)

  const isSuperAdmin = profile?.role === 'super_admin'
  const isOwner = profile?.role === 'owner'
  const isStaff = profile?.role === 'staff'

  useEffect(() => {
    const d = new Date()
    d.setSeconds(0, 0)
    setStableNow(d.toISOString())
  }, [])

  const transactionsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      orderBy("createdAt", "desc"),
      limit(5)
    )
  }, [db, tenant?.id])

  const broadcastsQuery = useMemoFirebase(() => {
    if (!db || !user || !stableNow) return null
    return query(
      collection(db, "platform_broadcasts"),
      where("activeUntil", ">=", stableNow),
      orderBy("activeUntil", "asc"),
      limit(1)
    )
  }, [db, user, stableNow])

  const { data: transactions, isLoading: isTxLoading } = useCollection(transactionsQuery)
  const { data: broadcasts } = useCollection(broadcastsQuery)

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/auth")
    }
  }, [user, isUserLoading, router])

  if (isUserLoading || !stableNow) return (
    <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-12 flex flex-col items-center gap-4">
      <ShieldCheck className="h-10 w-10 animate-bounce" />
      Syncing Intelligence...
    </div>
  )

  if (!user) return null

  if (tenant?.status === 'suspended' && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6 bg-destructive/5">
        <ShieldX className="h-20 w-20 text-destructive animate-bounce" />
        <h1 className="text-3xl font-black text-foreground uppercase tracking-tighter">Access Denied</h1>
        <p className="text-muted-foreground text-sm font-medium">Subscription restricted.</p>
        <Button className="w-full h-16 rounded-[24px] bg-primary" onClick={() => window.open('mailto:support@freshtally.com')}>CONTACT SUPPORT</Button>
      </div>
    )
  }

  if (!isSuperAdmin && !profile?.tenantId && !isUserLoading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[70vh] gap-6">
        <div className="h-24 w-24 bg-red-50 rounded-[32px] flex items-center justify-center text-destructive">
          <AlertCircle className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Identity Error</h2>
          <p className="text-muted-foreground text-sm font-medium px-4">Your account is not associated with a business tenant. Please contact your store owner or administrator.</p>
        </div>
        <Button 
          variant="outline"
          className="w-full h-16 rounded-[24px] font-black uppercase" 
          onClick={() => router.push('/auth')}
        >
          Return to Login
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {broadcasts && broadcasts.length > 0 && (
        <div className={cn(
          "p-5 rounded-[28px] flex gap-4 items-center animate-in slide-in-from-top-4",
          broadcasts[0].priority === 'critical' ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
        )}>
          <Megaphone className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">System Dispatch</p>
            <p className="text-sm font-black uppercase truncate mt-0.5">{broadcasts[0].title}</p>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase leading-none">
            {isStaff ? "Workstation" : "Intelligence"}
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
            {isStaff ? "Operational Hub" : "Real-time shop metrics"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="h-12 w-12 flex items-center justify-center rounded-2xl bg-gray-100 text-primary active:scale-90 transition-all">
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </header>

      {isStaff && (
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => router.push('/pos')}
            className="bg-primary p-6 rounded-[32px] text-white shadow-xl shadow-primary/20 flex flex-col items-center gap-3 active:scale-95 transition-all"
          >
            <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">POS Terminal</span>
          </button>
          <button 
            onClick={() => router.push('/inventory')}
            className="bg-white border-2 border-primary/10 p-6 rounded-[32px] flex flex-col items-center gap-3 active:scale-95 transition-all"
          >
            <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center text-primary">
              <Package className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Inventory</span>
          </button>
        </div>
      )}

      {isOwner && (
        <>
          <DashboardStats />
          <div className="bg-white/50 backdrop-blur-[2px] rounded-[32px] p-5 shadow-sm border border-gray-100/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Revenue Growth</h3>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[8px] font-black">LIVE</span>
            </div>
            <RevenueChart />
          </div>
          <ExpenseAITool />
        </>
      )}

      <section className="space-y-4 pb-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Recent Ledger</h3>
          <Button variant="ghost" className="h-8 text-[9px] font-black uppercase text-primary" onClick={() => router.push('/pos')}>View All</Button>
        </div>
        <div className="space-y-2">
          {isTxLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse text-[10px] font-black uppercase tracking-widest">Auditing Ledger...</div>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-card p-4 rounded-[24px] flex items-center justify-between shadow-sm border border-gray-50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-12 w-12 rounded-[16px] flex items-center justify-center",
                    tx.type === "Sale" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    {tx.type === "Sale" ? <ShoppingCart className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-tighter leading-none">{tx.type}</p>
                    <p className="text-[9px] text-muted-foreground font-bold mt-1 uppercase tracking-widest">
                      {tx.createdAt ? new Date(tx.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-black text-sm", tx.type === "Sale" ? "text-green-600" : "text-red-600")}>
                    {tx.type === "Sale" ? "+" : "-"}{formatCurrency(tx.totalAmount || 0)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-gray-50 rounded-[32px] p-8 text-center border-2 border-dashed border-gray-200">
              <Store className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">No transactions logged</p>
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  )
}
