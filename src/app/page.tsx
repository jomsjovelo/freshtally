'use client';

import { useEffect, useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { ShoppingCart, Package, Megaphone, TrendingDown, Loader2, Sparkles, ArrowUpRight, AlertCircle, CreditCard } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  where, 
  addDoc, 
  serverTimestamp, 
  writeBatch, 
  doc, 
  increment, 
  getDocs, 
  Timestamp 
} from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Banknote, FileText, TrendingUp, History, Wallet, Truck } from "lucide-react"
import { ProductSchema, ExpenseSchema } from "@/lib/schemas"
import { useToast } from "@/hooks/use-toast"

const DashboardAnalytics = dynamic(() => import("@/components/dashboard/dashboard-analytics").then(mod => mod.DashboardAnalytics), {
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
      Loading Store Data...
    </div>
  )
}

function DashboardContent({ profile, tenant, stableNow }: { profile: any, tenant: any, stableNow: string }) {
  const db = useFirestore()
  const router = useRouter()

  // STRICT SCOPE: Only initiate query if profile and tenant are perfectly synced
  const transactionsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id || !profile?.tenantId || tenant.id !== profile.tenantId) return null;
    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      orderBy("createdAt", "desc"),
      limit(5)
    )
  }, [db, tenant?.id, profile?.tenantId])

  const broadcastsQuery = useMemoFirebase(() => {
    if (!db || !stableNow) return null
    return query(
      collection(db, "platform_broadcasts"),
      where("activeUntil", ">=", stableNow),
      orderBy("activeUntil", "asc"),
      limit(1)
    )
  }, [db, stableNow])

  const clientsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(collection(db, "tenants", tenant.id, "b2bClients"))
  }, [db, tenant?.id])

  const productsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(collection(db, "tenants", tenant.id, "products"), orderBy("name", "asc"))
  }, [db, tenant?.id])

  const { data: transactions, isLoading: isTxLoading } = useCollection(transactionsQuery)
  const { data: broadcasts } = useCollection(broadcastsQuery)
  const { data: clients } = useCollection(clientsQuery)
  const { data: products } = useCollection(productsQuery)

  const totalCredit = useMemo(() => {
    if (!clients) return 0
    return clients.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0)
  }, [clients])

  const [greeting, setGreeting] = useState("Hello")
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const { toast } = useToast()

  // Cash Flow Action States
  const [isTookCashOpen, setIsTookCashOpen] = useState(false)
  const [tookCashData, setTookCashData] = useState({ amount: "", reason: "" })

  const [isLogDeliveryOpen, setIsLogDeliveryOpen] = useState(false)
  const [deliveryData, setDeliveryData] = useState({ productId: "", quantity: "", cost: "" })

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good Morning")
    else if (hour < 17) setGreeting("Good Afternoon")
    else setGreeting("Good Evening")
  }, [])

  const handleTookCash = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tenant?.id || !tookCashData.amount) return
    setIsGenerating(true)
    try {
      const validation = ExpenseSchema.safeParse({
        description: `Cash Out: ${tookCashData.reason || "Personal/Misc"}`,
        amount: Number(tookCashData.amount),
        category: "Personal/Misc",
        tenantId: tenant.id,
        expenseDate: new Date().toISOString()
      })
      if (!validation.success) throw new Error(validation.error.errors[0].message)
      await addDoc(collection(db, "tenants", tenant.id, "expenses"), {
        ...validation.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Cash Logged", description: "Your expected cash balance has been updated." })
      setIsTookCashOpen(false)
      setTookCashData({ amount: "", reason: "" })
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLogDelivery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tenant?.id || !deliveryData.productId || !deliveryData.cost) return
    setIsGenerating(true)
    try {
      const product = products?.find(p => p.id === deliveryData.productId)
      const batch = writeBatch(db)
      
      // 1. Record Expense
      const expRef = doc(collection(db, "tenants", tenant.id, "expenses"))
      batch.set(expRef, {
        description: `Delivery: ${product?.name}`,
        amount: Number(deliveryData.cost),
        category: "Inventory Purchase",
        tenantId: tenant.id,
        expenseDate: new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      // 2. Increment Stock
      const prodRef = doc(db, "tenants", tenant.id, "products", deliveryData.productId)
      batch.update(prodRef, {
        stock: increment(Number(deliveryData.quantity || 0)),
        updatedAt: serverTimestamp()
      })

      await batch.commit()
      toast({ title: "Delivery Recorded", description: `Added ${deliveryData.quantity} to ${product?.name} stock.` })
      setIsLogDeliveryOpen(false)
      setDeliveryData({ productId: "", quantity: "", cost: "" })
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const isStaff = profile?.role === 'staff'
  const isOwner = profile?.role === 'owner' || profile?.role === 'super_admin'

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto pb-32 animate-in fade-in duration-700">
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
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase leading-tight">
            {greeting}, {profile?.displayName?.split(' ')[0] || 'Partner'}
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-2">
            {tenant?.name || 'SYNCING...'} • {profile?.role || 'AUTH'}
          </p>
        </div>
        <button 
          id="dashboard-spark-btn"
          name="dashboard-spark-btn"
          onClick={() => router.push('/settings')}
          className="h-14 w-14 rounded-[24px] bg-primary/5 hover:bg-primary/10 flex items-center justify-center text-primary border border-primary/10 transition-all active:scale-95 shadow-soft"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      </header>

      {isStaff && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            id="quick-checkout-btn"
            name="quick-checkout-btn"
            onClick={() => router.push('/pos')}
            className="bg-primary p-8 rounded-[40px] text-white shadow-xl shadow-primary/20 flex flex-col items-center gap-4 active:scale-[0.97] transition-all group"
          >
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">Sell</span>
          </button>
          <button 
            id="quick-registry-btn"
            name="quick-registry-btn"
            onClick={() => router.push('/inventory')}
            className="bg-white border-2 border-gray-100 p-8 rounded-[40px] flex flex-col items-center gap-4 active:scale-[0.97] transition-all text-foreground shadow-soft group"
          >
            <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">Items</span>
          </button>
        </div>
      )}

      {/* QUICK CASH FLOW ACTIONS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Dialog open={isTookCashOpen} onOpenChange={setIsTookCashOpen}>
          <DialogTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-3 p-6 bg-white border-2 border-gray-100 rounded-[40px] shadow-soft active:scale-95 transition-all group">
              <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 group-hover:bg-red-100 transition-colors">
                <Wallet className="h-7 w-7" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Took Cash</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-[90%] rounded-[40px] border-none p-0 bg-white overflow-hidden shadow-2xl">
            <DialogHeader className="p-10 pb-6 bg-red-500 text-white">
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Took Cash</DialogTitle>
              <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Log money taken from drawer</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTookCash} className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">How Much?</Label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-2xl text-muted-foreground">₱</span>
                  <Input 
                    type="number" 
                    required
                    className="h-20 rounded-3xl bg-gray-50 border-none pl-12 pr-6 text-3xl font-black tracking-tighter" 
                    placeholder="0.00"
                    value={tookCashData.amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTookCashData({...tookCashData, amount: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">For What? (Optional)</Label>
                <Input 
                  className="h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold" 
                  placeholder="e.g. Lunch, Taxi, Repairs"
                  value={tookCashData.reason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTookCashData({...tookCashData, reason: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full h-18 rounded-2xl bg-red-500 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-red-500/20" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : "LOG CASH OUT"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isLogDeliveryOpen} onOpenChange={setIsLogDeliveryOpen}>
          <DialogTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-3 p-6 bg-white border-2 border-gray-100 rounded-[40px] shadow-soft active:scale-95 transition-all group">
              <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition-colors">
                <Truck className="h-7 w-7" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Log Delivery</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-[90%] rounded-[40px] border-none p-0 bg-white overflow-hidden shadow-2xl">
            <DialogHeader className="p-10 pb-6 bg-blue-500 text-white">
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Log Delivery</DialogTitle>
              <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Add Stock & Pay Supplier</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleLogDelivery} className="p-8 space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Item</Label>
                <Select onValueChange={(val: string) => setDeliveryData({...deliveryData, productId: val})}>
                  <SelectTrigger className="h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold">
                    <SelectValue placeholder="Which product?" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl max-h-[200px]">
                    {products?.map(p => (
                      <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quantity</Label>
                  <Input 
                    type="number" 
                    placeholder="0"
                    className="h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold"
                    value={deliveryData.quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryData({...deliveryData, quantity: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cost Paid</Label>
                  <Input 
                    type="number" 
                    placeholder="₱ 0.00"
                    className="h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold text-blue-600"
                    value={deliveryData.cost}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryData({...deliveryData, cost: e.target.value})}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-18 rounded-2xl bg-blue-500 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : "COMPLETE LOG"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isOwner && (
        <>
          <DashboardStats />
          
          <div className="bg-white p-7 rounded-[40px] border-2 border-primary/10 shadow-soft flex items-center justify-between group active:scale-95 transition-all">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 rounded-[22px] bg-primary/5 text-primary flex items-center justify-center">
                <CreditCard className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Money Owed to You</p>
                <p className="text-2xl font-black uppercase tracking-tighter mt-0.5">Credit Summary</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(totalCredit)}</p>
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-40">All Clients</p>
            </div>
          </div>

          <DashboardAnalytics />
          
          <div className="flex gap-4">
            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="flex-1 h-20 rounded-[32px] bg-accent text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-accent/20 active:scale-95 transition-all"
                  onClick={async () => {
                    if (!db || !tenant?.id) return
                    setIsGenerating(true)
                    try {
                      const startOfDay = new Date()
                      startOfDay.setHours(0, 0, 0, 0)
                      
                      const txSnap = await getDocs(query(
                        collection(db, "tenants", tenant.id, "transactions"),
                        where("createdAt", ">=", Timestamp.fromDate(startOfDay))
                      ))
                      
                      const expSnap = await getDocs(query(
                        collection(db, "tenants", tenant.id, "expenses"),
                        where("createdAt", ">=", Timestamp.fromDate(startOfDay))
                      ))
                      
                      let sales = 0
                      let cashSales = 0
                      let costOfGoods = 0
                      txSnap.forEach(doc => {
                        const data = doc.data()
                        sales += (data.totalAmount || 0)
                        costOfGoods += (data.totalCost || 0)
                        if (data.paymentType === 'cash') cashSales += (data.totalAmount || 0)
                      })
                      
                      let expenses = 0
                      expSnap.forEach(doc => expenses += (doc.data().amount || 0))
                      
                      setReportData({
                        sales,
                        expenses,
                        cashSales,
                        profit: sales - costOfGoods - expenses,
                        txCount: txSnap.size
                      })
                    } catch (err) {
                      console.error(err)
                    } finally {
                      setIsGenerating(false)
                    }
                  }}
                >
                  {isGenerating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <FileText className="h-5 w-5 mr-2" />}
                  End of Day Report
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md w-[90%] rounded-[40px] border-none p-0 bg-white overflow-hidden shadow-2xl">
                <DialogHeader className="p-10 pb-6 bg-accent text-white">
                  <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Business Summary</DialogTitle>
                  <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Today's Performance</DialogDescription>
                </DialogHeader>
                
                {reportData && (
                  <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                        <p className="text-[9px] font-black text-muted-foreground uppercase mb-2 tracking-widest">Gross Sales</p>
                        <p className="text-xl font-black text-foreground tracking-tighter">{formatCurrency(reportData.sales)}</p>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                        <p className="text-[9px] font-black text-muted-foreground uppercase mb-2 tracking-widest">Transactions</p>
                        <p className="text-xl font-black text-foreground tracking-tighter">{reportData.txCount}</p>
                      </div>
                    </div>

                    <div className="bg-green-50 p-6 rounded-3xl border border-green-100 flex justify-between items-center">
                      <div>
                        <p className="text-[9px] font-black text-green-700 uppercase mb-1 tracking-widest">Net Profit</p>
                        <p className="text-3xl font-black text-green-800 tracking-tighter">{formatCurrency(reportData.profit)}</p>
                      </div>
                      <TrendingUp className="h-10 w-10 text-green-200" />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cash on Hand</span>
                        </div>
                        <span className="font-black text-primary">{formatCurrency(reportData.cashSales)}</span>
                      </div>
                      <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-destructive" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Daily Expenses</span>
                        </div>
                        <span className="font-black text-destructive">-{formatCurrency(reportData.expenses)}</span>
                      </div>
                    </div>

                    <Button className="w-full h-16 rounded-2xl bg-primary text-white font-black uppercase" onClick={() => setIsReportOpen(false)}>
                      Close Summary
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Button 
              variant="outline"
              className="flex-1 h-20 rounded-[32px] border-2 border-primary/10 text-primary font-black uppercase text-xs tracking-widest hover:bg-primary/5 transition-all"
              onClick={() => router.push('/inventory')}
            >
              <History className="h-5 w-5 mr-2" />
              Manage Inventory
            </Button>
          </div>

          <ExpenseAITool />
        </>
      )}

      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Recent Transactions</h3>
          <Button variant="ghost" className="h-8 text-[9px] font-black uppercase opacity-60 hover:opacity-100">View All</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {isTxLoading ? (
            <div className="p-12 text-center text-muted-foreground animate-pulse text-[10px] font-black uppercase tracking-widest">Loading history...</div>
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
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
                {isStaff ? "Ready for your first sale" : "Add your first product to start selling"}
              </p>
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setStableNow(new Date().toISOString())
  }, [])

  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push("/auth")
    }
  }, [user, isUserLoading, router, mounted])

  useEffect(() => {
    if (mounted && !isUserLoading && user && !profile?.tenantId && !tenant) {
      router.push("/onboarding")
    }
  }, [user, profile, tenant, isUserLoading, router, mounted])

  if (!mounted || isUserLoading) return <SyncingTerminal />

  if (!user || !profile || (!tenant && profile.role !== 'super_admin')) {
    if (user && profile && !tenant && profile.role !== 'super_admin') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-gray-50">
          <div className="h-24 w-24 bg-destructive/5 text-destructive rounded-[40px] flex items-center justify-center mb-6 border border-destructive/10">
            <AlertCircle className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter leading-tight">Store Not Found</h1>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mt-4 leading-relaxed max-w-xs">
            The linked store profile is no longer active. Contact an administrator or set up a new store.
          </p>
          <Button 
            id="init-new-store-btn"
            name="init-new-store-btn"
            className="w-full max-w-xs h-16 rounded-[24px] bg-primary text-white font-black mt-10 shadow-xl"
            onClick={() => router.push('/onboarding')}
          >
            SET UP NEW STORE
          </Button>
        </div>
      )
    }
    return <SyncingTerminal />
  }

  return <DashboardContent profile={profile} tenant={tenant} stableNow={stableNow} />
}