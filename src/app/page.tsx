
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { ExpenseAITool } from "@/components/dashboard/expense-ai-tool"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Bell, Search, ShoppingCart, Package, ShieldX, PlusCircle, ShieldCheck, Store, Activity, Megaphone, Info, AlertTriangle } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where } from "firebase/firestore"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const { profile, tenant, isUserLoading, user } = useUser()
  const router = useRouter()
  const db = useFirestore()

  const transactionsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      orderBy("createdAt", "desc"),
      limit(5)
    )
  }, [db, tenant?.id])

  const broadcastsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "platform_broadcasts"),
      where("activeUntil", ">=", new Date().toISOString()),
      orderBy("activeUntil", "asc"),
      limit(1)
    )
  }, [db, user])

  const { data: transactions, isLoading: isTxLoading } = useCollection(transactionsQuery)
  const { data: broadcasts } = useCollection(broadcastsQuery)

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/auth")
    } else if (!isUserLoading && user && !profile) {
      router.push("/onboarding")
    }
  }, [profile, user, isUserLoading, router])

  if (isUserLoading) return <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-12">Synchronizing State...</div>

  // Suspension Guard
  if (tenant?.status === 'suspended' && profile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6 bg-destructive/5">
        <div className="h-24 w-24 bg-destructive text-white rounded-full flex items-center justify-center shadow-2xl animate-bounce">
          <ShieldX className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tighter">Subscription Expired</h1>
          <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-[280px]">
            Your access to <span className="text-foreground font-black">{tenant.name}</span> has been restricted. Please settle your balance.
          </p>
        </div>
        <Button className="w-full h-16 rounded-[24px] bg-primary font-black text-lg shadow-xl" onClick={() => window.open('mailto:jomsjovelo@gmail.com')}>CONTACT SUPPORT</Button>
      </div>
    )
  }

  // SUPER ADMIN VIEW (GENESIS HUB) - Redirect to specialized page handled by bottom nav but fallback here
  if (profile?.role === 'super_admin') {
    return <div className="p-20 text-center animate-pulse font-black uppercase text-xs tracking-widest">Redirecting to Genesis Hub...</div>
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
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase leading-none">Intelligence</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
            Real-time shop metrics
          </p>
        </div>
        <div className="flex gap-2">
          <button className="h-12 w-12 flex items-center justify-center rounded-2xl bg-gray-100 text-primary transition-all active:scale-90 hover:bg-gray-200">
            <Search className="h-5 w-5" />
          </button>
          <button className="h-12 w-12 flex items-center justify-center rounded-2xl bg-gray-100 text-primary transition-all active:scale-90 hover:bg-gray-200 relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-3 right-3 h-2 w-2 bg-accent rounded-full border-2 border-white animate-pulse"></span>
          </button>
        </div>
      </header>

      <DashboardStats />

      <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-[2px] rounded-[32px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-black flex items-center justify-between uppercase tracking-tighter">
            Revenue Performance
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">REAL-TIME</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart />
        </CardContent>
      </Card>

      <ExpenseAITool />

      <section className="space-y-4 pb-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Recent Activity</h3>
        <div className="space-y-2">
          {isTxLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse text-[10px] font-black uppercase tracking-widest">Reading Ledger...</div>
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
                      {tx.createdAt ? new Date(tx.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-black text-sm", tx.type === "Sale" ? "text-green-600" : "text-red-600")}>
                    {tx.type === "Sale" ? "+" : "-"}{formatCurrency(tx.totalAmount || tx.amount || 0)}
                  </p>
                  <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-60">SUCCESS</p>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-gray-50 rounded-[32px] p-8 text-center border-2 border-dashed border-gray-200">
              <PlusCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No Transactions Found</p>
              <Button 
                variant="link" 
                className="mt-2 text-primary font-black uppercase tracking-tighter"
                onClick={() => router.push('/pos')}
              >
                Start First Sale
              </Button>
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  )
}
