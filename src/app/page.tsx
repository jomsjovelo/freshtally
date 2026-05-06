'use client';

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { ShoppingCart, Package, Megaphone, TrendingDown, Store, Loader2, Sparkles, AlertCircle } from "lucide-react"
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

function SyncingTerminal() {
  return (
    <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-24 flex flex-col items-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin" />
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
    <div className="p-4 space-y-6 max-w-md mx-auto">
      {broadcasts && broadcasts.length > 0 && (
        <div className={cn(
          "p-5 rounded-[28px] flex gap-4 items-center animate-in slide-in-from-top-4 shadow-sm",
          broadcasts[0].priority === 'critical' ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
        )}>
          <Megaphone className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Platform Broadcast</p>
            <p className="text-sm font-black uppercase truncate mt-0.5">{broadcasts[0].title}</p>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase leading-none">
            {isStaff ? "Terminal" : "Ledger"}
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
            {tenant?.name} • {profile?.role}
          </p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
          <Sparkles className="h-5 w-5" />
        </div>
      </header>

      {isStaff && (
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => router.push('/pos')}
            className="bg-primary p-6 rounded-[32px] text-white shadow-xl flex flex-col items-center gap-3 active:scale-95 transition-all"
          >
            <ShoppingCart className="h-6 w-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">POS Terminal</span>
          </button>
          <button 
            onClick={() => router.push('/inventory')}
            className="bg-white border-2 border-primary/10 p-6 rounded-[32px] flex flex-col items-center gap-3 active:scale-95 transition-all text-primary shadow-sm"
          >
            <Package className="h-6 w-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">Inventory</span>
          </button>
        </div>
      )}

      {isOwner && (
        <>
          <DashboardStats />
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100/50">
            <RevenueChart />
          </div>
          <ExpenseAITool />
        </>
      )}

      <section className="space-y-4 pb-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Global activity</h3>
        <div className="space-y-3">
          {isTxLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse text-[10px] font-black uppercase tracking-widest">Auditing Ledger...</div>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-white p-5 rounded-[28px] flex items-center justify-between shadow-sm border border-gray-50 active:scale-98 transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-[18px] flex items-center justify-center",
                    tx.type === "Sale" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    {tx.type === "Sale" ? <ShoppingCart className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase leading-none">{tx.type}</p>
                    <p className="text-[9px] text-muted-foreground font-bold mt-1.5 uppercase tracking-widest">
                      {tx.createdAt ? (tx.createdAt.toDate ? new Date(tx.createdAt.toDate()) : new Date(tx.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                    </p>
                  </div>
                </div>
                <p className={cn("font-black text-sm tracking-tight", tx.type === "Sale" ? "text-green-600" : "text-red-600")}>
                  {tx.type === "Sale" ? "+" : "-"}{formatCurrency(tx.totalAmount || 0)}
                </p>
              </div>
            ))
          ) : (
            <div className="bg-gray-50 rounded-[32px] p-10 text-center border-2 border-dashed border-gray-200">
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
  const { profile, tenant, isUserLoading, user, userError } = useUser()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [stableNow, setStableNow] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const d = new Date()
    d.setSeconds(0, 0)
    setStableNow(d.toISOString())
  }, [])

  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push("/auth")
    }
  }, [user, isUserLoading, router, mounted])

  if (!mounted || isUserLoading || !stableNow) {
    return <SyncingTerminal />
  }

  if (user && profile?.tenantId && !tenant) {
    const isOwner = profile.role === 'owner'
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[80vh] gap-8 max-w-md mx-auto animate-in fade-in zoom-in duration-500">
        <div className="h-28 w-28 bg-red-50 rounded-[40px] flex items-center justify-center text-destructive shadow-inner relative">
           <AlertCircle className="h-14 w-14" />
           <div className="absolute -top-2 -right-2 h-8 w-8 bg-white rounded-full flex items-center justify-center shadow-md">
             <Store className="h-4 w-4 text-destructive" />
           </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-foreground leading-tight">Store Not Found</h2>
          <p className="text-muted-foreground text-sm font-medium px-4 leading-relaxed">
            Your store node (ID: {profile.tenantId}) could not be located in the cloud registry. It may have been decommissioned.
          </p>
        </div>
        <div className="w-full space-y-3">
          {isOwner ? (
            <Button 
              className="w-full h-18 rounded-[24px] font-black uppercase text-lg shadow-xl bg-primary" 
              onClick={() => router.push('/onboarding')}
            >
              INITIALIZE NEW STORE
            </Button>
          ) : (
            <Button 
              className="w-full h-18 rounded-[24px] font-black uppercase text-lg shadow-xl bg-destructive" 
              onClick={() => router.push('/auth')}
            >
              TERMINATE SESSION
            </Button>
          )}
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
            System Identity: {user.email}
          </p>
        </div>
      </div>
    )
  }

  if (userError || !user || !profile || !profile.tenantId || !tenant || profile.tenantId !== tenant.id) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[70vh] gap-6 max-w-md mx-auto">
        <div className="h-24 w-24 bg-blue-50 rounded-[32px] flex items-center justify-center text-primary shadow-inner">
          <Store className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-foreground">Terminal Offline</h2>
          <p className="text-muted-foreground text-sm font-medium px-4">
            Identity verification required. Connect to your Store Node.
          </p>
        </div>
        <Button 
          className="w-full h-16 rounded-[24px] font-black uppercase shadow-xl" 
          onClick={() => router.push('/auth')}
        >
          STORE ACCESS
        </Button>
      </div>
    )
  }

  return (
    <DashboardContent 
      user={user} 
      profile={profile} 
      tenant={tenant} 
      stableNow={stableNow} 
    />
  )
}