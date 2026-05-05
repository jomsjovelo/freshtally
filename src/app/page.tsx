'use client';

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { Bell, ShoppingCart, Package, ShieldX, Megaphone, TrendingDown, Store, Loader2 } from "lucide-react"
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
  const [mounted, setMounted] = useState(false)
  const [stableNow, setStableNow] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const d = new Date()
    d.setSeconds(0, 0)
    setStableNow(d.toISOString())
  }, [])

  // CRITICAL: Strict guarding for sub-collection queries to prevent permission errors
  const transactionsQuery = useMemoFirebase(() => {
    // Only fire query if security context is fully established
    if (!db || !user || isUserLoading || !profile?.tenantId || !tenant?.id) return null
    // Ensure user profile actually belongs to the active tenant being queried
    if (profile.tenantId !== tenant.id && profile.role !== 'super_admin') return null
    
    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      orderBy("createdAt", "desc"),
      limit(5)
    )
  }, [db, user?.uid, isUserLoading, profile?.tenantId, tenant?.id, profile?.role])

  const broadcastsQuery = useMemoFirebase(() => {
    if (!db || !user || !stableNow || isUserLoading) return null
    return query(
      collection(db, "platform_broadcasts"),
      where("activeUntil", ">=", stableNow),
      orderBy("activeUntil", "asc"),
      limit(1)
    )
  }, [db, user?.uid, stableNow, isUserLoading])

  const { data: transactions, isLoading: isTxLoading } = useCollection(transactionsQuery)
  const { data: broadcasts } = useCollection(broadcastsQuery)

  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push("/auth")
    }
  }, [user, isUserLoading, router, mounted])

  // Hydration and loading guards
  if (!mounted || isUserLoading || !stableNow) return (
    <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-24 flex flex-col items-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin" />
      Syncing Intelligence...
    </div>
  )

  if (!user) return null

  // Handle uninitialized business nodes
  const isZombie = (!profile?.tenantId || !tenant) && !isUserLoading;
  if (isZombie) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[70vh] gap-6">
        <div className="h-24 w-24 bg-blue-50 rounded-[32px] flex items-center justify-center text-primary">
          <Store className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Station Offline</h2>
          <p className="text-muted-foreground text-sm font-medium px-4">Your business node could not be found. Initialize your terminal to proceed.</p>
        </div>
        <Button 
          className="w-full h-16 rounded-[24px] font-black uppercase shadow-xl" 
          onClick={() => router.push('/auth')}
        >
          INITIALIZE TERMINAL
        </Button>
      </div>
    )
  }

  // Account suspension logic
  if (tenant?.status === 'suspended' && profile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6 bg-destructive/5">
        <ShieldX className="h-20 w-20 text-destructive animate-bounce" />
        <h1 className="text-3xl font-black text-foreground uppercase tracking-tighter">Access Denied</h1>
        <p className="text-muted-foreground text-sm font-medium">Subscription restricted.</p>
        <Button className="w-full h-16 rounded-[24px] bg-primary" onClick={() => window.open('mailto:support@freshtally.com')}>CONTACT SUPPORT</Button>
      </div>
    )
  }

  const isStaff = profile?.role === 'staff'
  const isOwner = profile?.role === 'owner' || profile?.role === 'super_admin'

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
            {isStaff ? "Terminal" : "Intelligence"}
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
            {isStaff ? "Operational Node" : "Real-time metrics"}
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
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Revenue Growth</h3>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[8px] font-black uppercase">Live Node</span>
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
        <div className="space-y-3">
          {isTxLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse text-[10px] font-black uppercase tracking-widest">Auditing Ledger...</div>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-white p-5 rounded-[28px] flex items-center justify-between shadow-sm border border-gray-50 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-[18px] flex items-center justify-center",
                    tx.type === "Sale" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    {tx.type === "Sale" ? <ShoppingCart className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-tighter leading-none">{tx.type}</p>
                    <p className="text-[9px] text-muted-foreground font-bold mt-1.5 uppercase tracking-widest">
                      {tx.createdAt ? (tx.createdAt.toDate ? new Date(tx.createdAt.toDate()) : new Date(tx.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-black text-sm tracking-tight", tx.type === "Sale" ? "text-green-600" : "text-red-600")}>
                    {tx.type === "Sale" ? "+" : "-"}{formatCurrency(tx.totalAmount || 0)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-gray-50 rounded-[32px] p-10 text-center border-2 border-dashed border-gray-200">
              <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">No transactions found</p>
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  )
}