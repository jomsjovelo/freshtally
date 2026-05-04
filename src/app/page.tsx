"use client"

import { useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Bell, Search, ShoppingCart, Package, ShieldX, PlusCircle, ShieldCheck, Megaphone, AlertTriangle, TrendingUp } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

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

  const isSuperAdmin = profile?.role === 'super_admin'
  const isOwner = profile?.role === 'owner'
  const isStaff = profile?.role === 'staff'

  const stableNow = useMemo(() => {
    const d = new Date()
    d.setSeconds(0, 0)
    return d.toISOString()
  }, [])

  const transactionsQuery = useMemoFirebase(() => {
    // FRESHTALLY V2: Extreme Gating
    // Do NOT fire sub-collection queries until the whole business context is stabilized and verified.
    if (!db || isUserLoading || !user || !tenant?.id || !profile?.tenantId || isSuperAdmin) return null
    
    // Safety check: ensure the profile and tenant documents are perfectly in sync before querying.
    if (!isSuperAdmin && profile.tenantId !== tenant.id) return null

    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      orderBy("createdAt", "desc"),
      limit(5)
    )
  }, [db, tenant?.id, profile, isUserLoading, isSuperAdmin, user])

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !isSuperAdmin || isUserLoading) return null
    return query(collection(db, "tenants"), orderBy("createdAt", "desc"), limit(20))
  }, [db, isSuperAdmin, isUserLoading])

  const broadcastsQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null
    return query(
      collection(db, "platform_broadcasts"),
      where("activeUntil", ">=", stableNow),
      orderBy("activeUntil", "asc"),
      limit(1)
    )
  }, [db, user, isUserLoading, stableNow])

  const { data: transactions, isLoading: isTxLoading } = useCollection(transactionsQuery)
  const { data: broadcasts } = useCollection(broadcastsQuery)
  const { data: tenants } = useCollection(tenantsQuery)

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/auth")
    }
  }, [user, isUserLoading, router])

  if (isUserLoading) return (
    <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-12 flex flex-col items-center gap-4">
      <ShieldCheck className="h-10 w-10 animate-bounce" />
      Finalizing Terminal Node...
    </div>
  )

  if (tenant?.status === 'suspended' && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6 bg-destructive/5">
        <div className="h-24 w-24 bg-destructive text-white rounded-full flex items-center justify-center shadow-2xl animate-bounce">
          <ShieldX className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tighter">Subscription Expired</h1>
          <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-[280px]">
            Your access to <span className="text-foreground font-black">{tenant?.name || 'this store'}</span> has been restricted. Please settle your balance.
          </p>
        </div>
        <Button className="w-full h-16 rounded-[24px] bg-primary font-black text-lg shadow-xl" onClick={() => window.open('mailto:jomsjovelo@gmail.com')}>CONTACT SUPPORT</Button>
      </div>
    )
  }

  if (isSuperAdmin) {
    const mrr = tenants?.reduce((acc, t) => {
      if (t.status !== 'active') return acc
      const planPrices = { free: 0, basic: 999, pro: 2499, enterprise: 4999 }
      return acc + (planPrices[t.subscriptionPlan as keyof typeof planPrices] || 0)
    }, 0) || 0

    return (
      <div className="p-4 space-y-6">
        <header className="flex items-center gap-4">
          <div className="h-16 w-16 bg-primary text-white rounded-[24px] flex items-center justify-center shadow-2xl">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Command Center</h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-2">Platform Hub</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <Card className="border-none shadow-sm bg-blue-50/50 rounded-[32px]">
            <CardContent className="p-5">
              <p className="text-[9px] font-black uppercase text-blue-600/70 tracking-widest mb-1">Platform MRR</p>
              <p className="text-2xl font-black tracking-tighter">{formatCurrency(mrr)}</p>
              <div className="flex items-center gap-1 text-[8px] font-black text-green-600 mt-2">
                <TrendingUp className="w-3 h-3" /> +14.2% THIS MONTH
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-accent/5 rounded-[32px]">
            <CardContent className="p-5">
              <p className="text-[9px] font-black uppercase text-accent/70 tracking-widest mb-1">Active Nodes</p>
              <p className="text-2xl font-black tracking-tighter">{tenants?.filter(t => t.status === 'active').length || 0}</p>
              <div className="text-[8px] font-black text-accent mt-2 uppercase tracking-widest">System Healthy</div>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Recent Activity</h3>
          <div className="space-y-2">
            {tenants?.slice(0, 5).map(t => (
              <div key={t.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-primary text-sm uppercase">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight leading-none">{t.name}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">New Node</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-[8px] uppercase font-black px-2">{t.subscriptionPlan}</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>

        <BottomNav />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {broadcasts && broadcasts.length > 0 && (
        <div className={cn(
          "p-5 rounded-[28px] flex gap-4 items-center animate-in slide-in-from-top-4 duration-500",
          broadcasts[0].priority === 'critical' ? "bg-red-50 text-red-700" : broadcasts[0].priority === 'warning' ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"
        )}>
          <div className="shrink-0">
            {broadcasts[0].priority === 'critical' ? <AlertTriangle className="h-6 w-6" /> : <Megaphone className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">System Dispatch</p>
            <p className="text-sm font-black uppercase tracking-tight leading-none mt-0.5">{broadcasts[0].title}</p>
            <p className="text-[10px] font-bold mt-1 opacity-80">{broadcasts[0].message}</p>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase leading-none">
            {isStaff ? "Service Portal" : "Intelligence"}
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
            {isStaff ? "Operational Overview" : "Real-time shop metrics"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="h-12 w-12 flex items-center justify-center rounded-2xl bg-gray-100 text-primary transition-all active:scale-90">
            <Search className="h-5 w-5" />
          </button>
          <button className="h-12 w-12 flex items-center justify-center rounded-2xl bg-gray-100 text-primary transition-all active:scale-90 relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-3 right-3 h-2 w-2 bg-accent rounded-full border-2 border-white animate-pulse"></span>
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
            <span className="text-[10px] font-black uppercase tracking-widest">Open Terminal</span>
          </button>
          <button 
            onClick={() => router.push('/inventory')}
            className="bg-white border-2 border-primary/10 p-6 rounded-[32px] flex flex-col items-center gap-3 active:scale-95 transition-all"
          >
            <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center text-primary">
              <Package className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Check Stock</span>
          </button>
        </div>
      )}

      {isOwner && (
        <>
          <DashboardStats />
          <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-[2px] rounded-[32px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black flex items-center justify-between uppercase tracking-tighter">
                Revenue Performance
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">7-DAY VIEW</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueChart />
            </CardContent>
          </Card>
          <ExpenseAITool />
        </>
      )}

      <section className="space-y-4 pb-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Recent Activity</h3>
        <div className="space-y-2">
          {isTxLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse text-[10px] font-black uppercase tracking-widest">Verifying Ledger...</div>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-card p-4 rounded-[24px] flex items-center justify-between shadow-sm border-none">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-12 w-12 rounded-[16px] flex items-center justify-center",
                    tx.type === "Sale" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    {tx.type === "Sale" ? <ShoppingCart className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-tighter leading-none">{tx.type}</p>
                    <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-widest">
                      {tx.createdAt ? new Date(tx.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Processing'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-black text-sm", tx.type === "Sale" ? "text-green-600" : "text-red-600")}>
                    {tx.type === "Sale" ? "+" : "-"}{formatCurrency(tx.totalAmount || tx.amount || 0)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-gray-50 rounded-[32px] p-8 text-center border-2 border-dashed border-gray-200">
              <PlusCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No activity logged</p>
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  )
}