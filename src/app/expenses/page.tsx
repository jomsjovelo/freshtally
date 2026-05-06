"use client"

import { useState, useMemo } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Filter, Receipt, TrendingDown, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, cn } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

export default function ExpensesPage() {
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const { tenant } = useUser()
  const db = useFirestore()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Miscellaneous",
    notes: ""
  })

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "expenses"),
      orderBy("createdAt", "desc"),
      limit(100)
    )
  }, [db, tenant?.id])

  const { data: expenses, isLoading } = useCollection(expensesQuery)

  const filteredExpenses = useMemo(() => {
    if (!expenses) return []
    return expenses.filter(e => e.description.toLowerCase().includes(search.toLowerCase()))
  }, [expenses, search])

  const totalMonthly = useMemo(() => {
    if (!expenses) return 0
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  }, [expenses])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id) return
    
    try {
      await addDoc(collection(db, "tenants", tenant.id, "expenses"), {
        ...formData,
        amount: Number(formData.amount),
        tenantId: tenant.id,
        expenseDate: new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      toast({ title: "Expense Recorded", description: "Ledger updated." })
      setIsAddOpen(false)
      setFormData({ description: "", amount: "", category: "Miscellaneous", notes: "" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-none text-primary">Expenses</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Outflow Registry</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-3xl bg-accent hover:bg-accent/90 shadow-xl">
              <Plus className="h-7 w-7" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-full h-[90vh] rounded-t-[40px] border-none p-0 bg-background overflow-hidden flex flex-col">
            <DialogHeader className="p-8 pb-4 bg-accent text-white">
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Record Outflow</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto flex-1 pb-32">
              <div className="space-y-2">
                <Label htmlFor="expense-desc" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">What was it for?</Label>
                <Input 
                  id="expense-desc"
                  name="expense-desc"
                  required
                  placeholder="e.g. Utility Bills, Rent, Inventory"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-bold text-lg"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expense-amount" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount (₱)</Label>
                <Input 
                  id="expense-amount"
                  name="expense-amount"
                  required
                  type="number"
                  placeholder="0.00"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-black text-2xl text-primary"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-cat" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                <select 
                  id="expense-cat"
                  name="expense-cat"
                  className="w-full h-16 rounded-2xl bg-gray-100 border-none font-bold px-4"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                  <option>Utilities</option>
                  <option>Inventory</option>
                  <option>Rent</option>
                  <option>Marketing</option>
                  <option>Software</option>
                  <option>Miscellaneous</option>
                </select>
              </div>

              <Button 
                type="submit" 
                className="w-full h-20 rounded-[28px] bg-accent text-white font-black text-xl shadow-xl mt-4"
              >
                LOG EXPENSE
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="border-none shadow-sm bg-primary p-6 rounded-[32px] text-white overflow-hidden relative">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Month Burn</p>
        <h2 className="text-4xl font-black mt-2 tracking-tighter">{formatCurrency(totalMonthly)}</h2>
        <div className="flex items-center gap-2 text-[10px] font-black mt-4 uppercase tracking-widest bg-white/10 w-fit px-3 py-1 rounded-full">
          <TrendingDown className="h-3 w-3" /> Ledger Active
        </div>
      </Card>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            id="expense-search"
            name="expense-search"
            placeholder="Search outflows..." 
            className="pl-12 h-14 bg-gray-100 border-none shadow-sm rounded-2xl font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Auditing...</div>
        ) : filteredExpenses.length > 0 ? (
          filteredExpenses.map((expense) => (
            <div key={expense.id} className="bg-card p-5 rounded-[28px] flex items-center justify-between shadow-sm border border-gray-50 active:scale-98 transition-all">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center text-primary">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tight leading-none">{expense.description}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-[8px] uppercase px-2 h-4 font-black">{expense.category}</Badge>
                    <span className="text-[8px] font-black text-muted-foreground uppercase">{new Date(expense.createdAt?.toDate()).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <p className="font-black text-sm text-destructive tracking-tight">
                -{formatCurrency(expense.amount)}
              </p>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
            <h3 className="text-lg font-black text-muted-foreground uppercase tracking-tighter">No History</h3>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}