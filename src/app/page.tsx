'use client';

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { ShoppingCart, Package, Megaphone, TrendingDown, Loader2, Sparkles, ArrowUpRight } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where } from "firebase/firestore"
import { Button } from "@/components/ui/button"

const RevenueChart = dynamic(() => import("@/components/dashboard/revenue-chart").then(mod => mod.RevenueChart), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-muted/20 animate-pulse rounded-[32px]" />
})

const ExpenseAITool = dynamic(() => import("@/components/dashboard/expense-ai-tool").then(mod => mod.ExpenseAITool), {
  ssr: false,
  loading: () => <div className="h-44 w-full bg-muted/10 animate-pulse rounded-[32px]" />
})

function SyncingTerminal() {
  return (
    <div className="p-12 text-center animate-pulse font-black text-primary uppercase text-[10px] tracking-[0.3em] mt-32 flex flex-col items-center gap-6">
      <div className="h-16 w-16 rounded-[28px] bg-primary/5 flex items-center justify-center border border-primary/10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
      Syncing Store Ledger...
    </div>
  )
}

function DashboardContent({ user, profile, tenant, stableNow }: { user: any, profile: any, tenant: any, stableNow: string }) {
  const db = useFirestore()
  const router = useRouter()

  const transactionsQuery = useMemoFirebase(() => {
    if (!db || !user || !tenant?.id || !profile?.tenantId) return null;
    if (tenant.id !== profile.tenantId) return null;

    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      orderBy("createdAt", "desc"),
      limit(5)
    )
  }, [db, user, tenant?.id, profile?.tenantId])

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

  const isStaff = profile?.role === 'staff'
  const isOwner = profile?.role === 'owner' || profile?.role === 'super_admin'

  return (
    <div className="p-6 space-y-8 max-w-md mx-auto pb-32 animate-in fade-in duration-700">
      {broadcasts && broadcasts.length > 0 && (
        <div className={cn(
          "p-5 rounded-[32px] flex gap-4 items-center animate-in slide-in-from-top-6 shadow-soft transition-all border border-transparent",
          broadcasts[0].priority === 'critical' ? "bg-red-50 text-red-700 border-red-100" : "bg-blue-50 text-blue-700 border-blue-100"
        )}>
          <div className="h-10 w-10 rounded-2xl bg-white/50 backdrop-blur-sm flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">System Notice</p>
            <p className="text-sm font-black uppercase truncate mt-0.5">{broadcasts[0].title}</p>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-primary uppercase leading-none">
            {isStaff ? "Terminal" : "Ledger"}
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-2">
            {tenant?.name || 'SYNCING...'} • {profile?.role || 'AUTH'}
          </p>
        </div>
        <button 
          onClick={() => router.push('/settings')}
          className="h-14 w-14 rounded-[24px] bg-primary/5 hover:bg-primary/10 flex items-center justify-center text-primary border border-primary/10 transition-all active:scale-95 shadow-soft"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      </header>

      {isStaff && (
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => router.push('/pos')}
            className="bg-primary p-8 rounded-[40px] text-white shadow-xl shadow-primary/20 flex flex-col items-center gap-4 active:scale-[0.97] transition-all group"
          >
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">Checkout</span>
          </button>
          <button 
            onClick={() => router.push('/inventory')}
            className="bg-white border-2 border-gray-100 p-8 rounded-[40px] flex flex-col items-center gap-4 active:scale-[0.97] transition-all text-foreground shadow-soft group"
          >
            <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">Registry</span>
          </button>
        </div>
      )}

      {isOwner && (
        <>
          <DashboardStats />
          <div className="bg-white rounded-[44px] p-8 shadow-soft border border-gray-100/50">
            <div className="flex justify-between items-center mb-6">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Revenue Flow</p>
              <div className="flex items-center gap-2 text-green-600">
                <ArrowUpRight className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase">Live</span>
              </div>
            </div>
            <RevenueChart />
          </div>
          <ExpenseAITool />
        </>
      )}

      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Global activity</h3>
          <Button variant="ghost" className="h-8 text-[9px] font-black uppercase opacity-60 hover:opacity-100">View All</Button>
        </div>
        <div className="space-y-3">
          {isTxLoading ? (
            <div className="p-12 text-center text-muted-foreground animate-pulse text-[10px] font-black uppercase tracking-widest">Auditing Ledger...</div>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-white p-6 rounded-[32px] flex items-center justify-between shadow-soft border border-gray-50/80 active:scale-98 transition-all hover:border-primary/10">
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "h-14 w-14 rounded-[22px] flex items-center justify-center transition-colors",
                    tx.type === "Sale" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    {tx.type === "Sale" ? <ShoppingCart className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-tight leading-none">{tx.type}</p>
                    <p className="text-[9px] text-muted-foreground font-bold mt-2 uppercase tracking-widest">
                      {tx.createdAt ? (tx.createdAt.toDate ? new Date(tx.createdAt.toDate()) : new Date(tx.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                    </p>
                  </div>
                </div>
                <p className={cn("font-black text-base tracking-tighter", tx.type === "Sale" ? "text-green-600" : "text-red-600")}>
                  {tx.type === "Sale" ? "+" : "-"}{formatCurrency(tx.totalAmount || 0)}
                </p>
              </div>
            ))
          ) : (
            <div className="bg-gray-50 rounded-[40px] p-16 text-center border-2 border-dashed border-gray-200">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Empty Ledger History</p>
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, profile, tenant, isUserLoading } = useUser()
  const [stableNow, setStableNow] = useState("")

  useEffect(() => {
    setStableNow(new Date().toISOString())
  }, [])

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/auth")
    }
  }, [user, isUserLoading, router])

  // Identity Handshake Recovery: Homeless accounts
  useEffect(() => {
    if (!isUserLoading && user && !profile?.tenantId && !tenant) {
      router.push("/onboarding")
    }
  }, [user, profile, tenant, isUserLoading, router])

  if (isUserLoading) return <SyncingTerminal />

  if (!user || !profile || (!tenant && profile.role !== 'super_admin')) {
    return <SyncingTerminal />
  }

  return <DashboardContent user={user} profile={profile} tenant={tenant} stableNow={stableNow} />
}
