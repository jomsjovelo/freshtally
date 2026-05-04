
"use client"

import { useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, UserCheck, PackageOpen, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, cn } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, doc, increment, writeBatch } from "firebase/firestore"
import { runFullSystemAudit } from "@/lib/stress-tests"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"

export default function POSPage() {
  const { tenant } = useUser()
  const db = useFirestore()
  const [cart, setCart] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'credit'>('cash')
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  const productsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(collection(db, "tenants", tenant.id, "products"), orderBy("name", "asc"))
  }, [db, tenant?.id])

  const clientsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(collection(db, "tenants", tenant.id, "b2bClients"), orderBy("name", "asc"))
  }, [db, tenant?.id])

  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery)
  const { data: clients } = useCollection(clientsQuery)

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter(item => item.id !== id))
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty }
      }
      return item
    }))
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const handleCheckout = async () => {
    if (!tenant?.id || isProcessing || cart.length === 0) return

    // Risk 3 Mitigation: Verify stock availability before committing
    const stockShortages = cart.filter(item => item.stock < item.quantity)
    if (stockShortages.length > 0) {
      toast({
        title: "Transaction Blocked",
        description: `Insufficient stock for: ${stockShortages.map(i => i.name).join(", ")}`,
        variant: "destructive",
      })
      return
    }

    if (paymentType === 'credit' && !selectedClientId) {
      toast({
        title: "Account Required",
        description: "Please select a B2B client for credit charges.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    try {
      const batch = writeBatch(db)
      
      const txColRef = collection(db, "tenants", tenant.id, "transactions")
      const txDocRef = doc(txColRef)
      batch.set(txDocRef, {
        tenantId: tenant.id,
        items: cart,
        totalAmount: total,
        paymentType,
        clientId: selectedClientId || null,
        createdAt: new Date(),
        type: "Sale"
      })

      if (paymentType === 'credit' && selectedClientId) {
        const clientRef = doc(db, "tenants", tenant.id, "b2bClients", selectedClientId)
        batch.update(clientRef, { outstandingBalance: increment(total) })
      }

      cart.forEach(item => {
        const productRef = doc(db, "tenants", tenant.id, "products", item.id)
        batch.update(productRef, { stock: increment(-item.quantity) })
      })

      await batch.commit()
      
      toast({
        title: "Order Processed",
        description: `Successfully logged sale of ${formatCurrency(total)}.`,
      })
      setCart([])
      setSelectedClientId(null)
      setPaymentType('cash')
    } catch (error: any) {
      toast({
        title: "Checkout Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <div className="p-4 flex-1 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Terminal</h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Ready for checkout</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-10 text-[8px] font-black uppercase text-accent border border-accent/20 rounded-xl"
            onClick={() => tenant?.id && runFullSystemAudit(db, tenant.id, cart)}
          >
            <Zap className="h-3 w-3 mr-1" /> Run Audit
          </Button>
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search catalog..." 
            className="pl-12 h-16 bg-white border-none shadow-sm rounded-[24px] font-bold text-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Store Catalog</h3>
          {isProductsLoading ? (
            <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Waking Terminal...</div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 pb-24">
              {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((product) => (
                <button 
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-5 rounded-[32px] shadow-sm border border-transparent active:scale-[0.95] active:bg-primary/5 transition-all text-left group"
                >
                  <p className="font-black text-sm leading-tight h-10 line-clamp-2 uppercase tracking-tight">{product.name}</p>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-primary font-black text-xs">{formatCurrency(product.price)}</span>
                    <div className="h-10 w-10 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <Plus className="h-5 w-5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[40px] p-12 text-center shadow-inner border border-gray-100">
              <PackageOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-black text-muted-foreground uppercase tracking-tighter">No Products</h3>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-2">Add inventory to begin selling.</p>
            </div>
          )}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="bg-white border-t border-border rounded-t-[48px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] p-8 space-y-6 animate-in slide-in-from-bottom-full duration-500 pb-28">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-xl flex items-center gap-2 tracking-tighter uppercase">
              <ShoppingCart className="h-6 w-6 text-primary" />
              Order Summary
            </h3>
            <span className="text-[10px] font-black bg-primary text-white px-4 py-1.5 rounded-full uppercase">{cart.length} ITEMS</span>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black uppercase tracking-tight truncate">{item.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">{item.stock} in stock</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-100 rounded-2xl h-12 px-3">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-primary"><Minus className="h-5 w-5" /></button>
                    <span className="text-base font-black w-10 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-primary"><Plus className="h-5 w-5" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-destructive p-3 hover:bg-destructive/5 rounded-2xl transition-colors"><Trash2 className="h-6 w-6" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', icon: Banknote, label: 'Cash' },
                { id: 'card', icon: CreditCard, label: 'Card' },
                { id: 'credit', icon: UserCheck, label: 'Charge' }
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setPaymentType(type.id as any)}
                  className={cn(
                    "flex flex-col items-center justify-center h-24 rounded-[24px] border-4 transition-all gap-2",
                    paymentType === type.id 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-gray-50 bg-transparent text-muted-foreground"
                  )}
                >
                  <type.icon className="h-6 w-6" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                </button>
              ))}
            </div>

            {paymentType === 'credit' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <Select onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-16 rounded-2xl border-none bg-gray-100 font-black uppercase text-xs tracking-widest px-6">
                    <SelectValue placeholder="SELECT B2B CLIENT" />
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl border-none shadow-2xl">
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id} className="font-bold py-3">{client.name}</SelectItem>
                    ))}
                    {(!clients || clients.length === 0) && (
                      <div className="p-4 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest">No Clients Found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-between items-center px-1">
              <span className="text-muted-foreground font-black text-[10px] uppercase tracking-widest">GRAND TOTAL</span>
              <span className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(total)}</span>
            </div>

            <Button 
              className="w-full h-20 rounded-[28px] bg-primary text-white font-black text-2xl shadow-[0_20px_40px_rgba(var(--primary),0.3)] active:scale-[0.98] transition-all"
              onClick={handleCheckout}
              disabled={isProcessing}
            >
              {isProcessing ? "PROCESSING..." : "FINALIZE ORDER"}
            </Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
