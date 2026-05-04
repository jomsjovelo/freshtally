
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { ExpenseAITool } from "@/components/dashboard/expense-ai-tool"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Bell, Search, ShoppingCart, Package, ShieldX } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/provider"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const { profile, tenant, isUserLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isUserLoading && profile?.role === 'staff') {
      router.push('/pos')
    }
  }, [profile, isUserLoading, router])

  if (isUserLoading) return <div className="p-8 text-center animate-pulse">Initializing SaaS session...</div>

  if (tenant?.status === 'suspended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
          <ShieldX className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground uppercase tracking-tighter">Subscription Expired</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your store access has been suspended. Please contact the system administrator to renew your plan.
          </p>
        </div>
        <Button className="w-full h-14 rounded-2xl bg-primary font-bold">Contact Support</Button>
      </div>
    )
  }

  if (profile?.role === 'staff') return null

  return (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">FreshTally</h1>
          <p className="text-sm text-muted-foreground">Store Overview: {tenant?.name || 'Loading...'}</p>
        </div>
        <div className="flex gap-2">
          <button className="h-10 w-10 flex items-center justify-center rounded-full bg-secondary text-primary transition-transform active:scale-95">
            <Search className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 flex items-center justify-center rounded-full bg-secondary text-primary transition-transform active:scale-95 relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 bg-accent rounded-full border-2 border-background"></span>
          </button>
        </div>
      </header>

      <DashboardStats />

      <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center justify-between">
            Revenue Performance
            <span className="text-xs font-normal text-muted-foreground uppercase tracking-widest">Last 7 Days</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart />
        </CardContent>
      </Card>

      <ExpenseAITool />

      <section className="space-y-3 pb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pl-1">Recent Transactions</h3>
        <div className="space-y-2">
          {[
            { id: 1, type: "Sale", amount: "+₱42.50", time: "2 mins ago", status: "Success" },
            { id: 2, type: "Expense", amount: "-₱120.00", time: "1 hour ago", status: "Pending" },
            { id: 3, type: "Sale", amount: "+₱15.00", time: "3 hours ago", status: "Success" },
          ].map((tx) => (
            <div key={tx.id} className="bg-card p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  tx.type === "Sale" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                )}>
                  {tx.type === "Sale" ? <ShoppingCart className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm">{tx.type} #{tx.id}</p>
                  <p className="text-xs text-muted-foreground">{tx.time}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("font-bold text-sm", tx.type === "Sale" ? "text-green-600" : "text-red-600")}>
                  {tx.amount}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">{tx.status}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <BottomNav />
    </div>
  )
}
