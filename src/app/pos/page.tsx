"use client"

import { useState, useMemo, useCallback, memo, useEffect } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, UserCheck, PackageOpen, Zap, Loader2, Share2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, cn } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { Badge } from "@/components/ui/badge"
import { collection, query, orderBy, doc, increment, writeBatch, limit, where, serverTimestamp, addDoc } from "firebase/firestore"
import { runFullSystemAudit } from "@/lib/stress-tests"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { Calendar as CalendarIcon, UserPlus } from "lucide-react"
import { TransactionSchema, ClientSchema } from "@/lib/schemas"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const ProductCard = memo(({ product, onAdd }: { product: any, onAdd: (p: any) => void }) => (
  <button 
    onClick={() => onAdd(product)}
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
))
ProductCard.displayName = "ProductCard"

export default function POSPage() {
  const { tenant, profile, isUserLoading, user } = useUser()
  const db = useFirestore()
  const [cart, setCart] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'credit'>('cash')
  const [isProcessing, setIsProcessing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<any>(null)
  const [creditDueDate, setCreditDueDate] = useState<Date | undefined>(undefined)
  
  // Client Registration State
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [newClientData, setNewClientData] = useState({
    name: "",
    type: "Regular",
    phone: "",
    email: "",
    address: ""
  })
  
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
  }, [])

  const productsQuery = useMemoFirebase(() => {
    if (!mounted || isUserLoading || !db || !tenant?.id || !profile?.tenantId || tenant.id !== profile.tenantId) return null
    return query(collection(db, "tenants", tenant.id, "products"), orderBy("name", "asc"), limit(100))
  }, [mounted, isUserLoading, db, tenant?.id, profile?.tenantId])

  const clientsQuery = useMemoFirebase(() => {
    if (!mounted || isUserLoading || !db || !tenant?.id || !profile?.tenantId || tenant.id !== profile.tenantId) return null
    return query(collection(db, "tenants", tenant.id, "b2bClients"), orderBy("name", "asc"), limit(50))
  }, [mounted, isUserLoading, db, tenant?.id, profile?.tenantId])

  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery)
  const { data: clients } = useCollection(clientsQuery)

  const addToCart = useCallback((product: any) => {
    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }, [])

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter(item => item.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty }
      }
      return item
    }))
  }, [])

  const { total, totalCost } = useMemo(() => {
    return cart.reduce((acc, item) => {
      // Wholesale logic: switch price if qty threshold met
      let price = item.price
      if (item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty) {
        price = item.wholesalePrice
      }
      
      acc.total += (price * item.quantity)
      acc.totalCost += ((item.costPrice || 0) * item.quantity)
      return acc
    }, { total: 0, totalCost: 0 })
  }, [cart])

  const filteredProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === "all" || p.categoryId === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, search, selectedCategory])

  const handleCheckout = async () => {
    if (!db || !tenant?.id || isProcessing || cart.length === 0) return

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
        description: "Select a B2B client.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    
    const client = clients?.find(c => c.id === selectedClientId)
    const checkoutItems = cart.map(item => {
      let price = item.price
      let isWholesale = false
      if (item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty) {
        price = item.wholesalePrice
        isWholesale = true
      }
      return { ...item, price, isWholesale }
    })

    const validation = TransactionSchema.safeParse({
      tenantId: tenant.id,
      items: checkoutItems,
      totalAmount: total,
      totalCost: totalCost,
      paymentType,
      clientId: selectedClientId || null,
      clientName: client?.name || null,
      dueDate: creditDueDate ? creditDueDate.toISOString() : null,
      type: "Sale"
    })

    if (!validation.success) {
      toast({ title: "Checkout Error", description: validation.error.errors[0].message, variant: "destructive" })
      setIsProcessing(false)
      return
    }

    try {
      const batch = writeBatch(db)
      const txColRef = collection(db, "tenants", tenant.id, "transactions")
      const txDocRef = doc(txColRef)
      
      batch.set(txDocRef, {
        ...validation.data,
        createdAt: serverTimestamp(),
      })

      if (paymentType === 'credit' && selectedClientId) {
        const clientRef = doc(db, "tenants", tenant.id, "b2bClients", selectedClientId)
        batch.update(clientRef, { 
          outstandingBalance: increment(total),
          updatedAt: serverTimestamp(),
          // Only set oldestUnpaidAt if it doesn't already exist
          ...(!client?.oldestUnpaidAt && { oldestUnpaidAt: serverTimestamp() })
        })
      }

      cart.forEach(item => {
        const productRef = doc(db, "tenants", tenant.id, "products", item.id)
        batch.update(productRef, { stock: increment(-item.quantity) })
      })

      await batch.commit()
      
      setLastTransaction({ 
        id: txDocRef.id, 
        ...validation.data,
        date: new Date() 
      })
      setShowReceipt(true)
      setCart([])
      setSelectedClientId(null)
      setPaymentType('cash')
      setCreditDueDate(undefined)
    } catch (error: any) {
      toast({ title: "Checkout Failed", description: error.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tenant?.id || isProcessing) return

    setIsProcessing(true)
    const validation = ClientSchema.safeParse({
      ...newClientData,
      tenantId: tenant.id
    })

    if (!validation.success) {
      toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" })
      setIsProcessing(false)
      return
    }

    try {
      const docRef = await addDoc(collection(db, "tenants", tenant.id, "b2bClients"), {
        ...validation.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Client Registered", description: `${newClientData.name} added to registry.` })
      setIsAddClientOpen(false)
      setSelectedClientId(docRef.id) // Automatically select the new client
      setNewClientData({ name: "", type: "Regular", phone: "", email: "", address: "" })
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleShareCreditSlip = async () => {
    if (!lastTransaction || !tenant) return
    const text = `*CREDIT SLIP*\n` +
      `*${tenant.name}*\n\n` +
      `Client: ${lastTransaction.clientName}\n` +
      `Total Owed: *${formatCurrency(lastTransaction.total)}*\n` +
      (lastTransaction.dueDate ? `Due Date: ${format(new Date(lastTransaction.dueDate), "MMM d, yyyy")}\n` : '') +
      `\n*Items:*\n` +
      lastTransaction.items.map((item: any) => {
        const isWholesale = item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty
        const price = isWholesale ? item.wholesalePrice : item.price
        return `- ${item.quantity} ${item.unit || 'x'} ${item.name}`
      }).join('\n') +
      `\n\n_Please settle by the agreed date. Thank you!_`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Credit Slip', text })
      } catch (err) {
        await navigator.clipboard.writeText(text)
        toast({ title: "Slip Copied", description: "Text saved to clipboard." })
      }
    } else {
      await navigator.clipboard.writeText(text)
      toast({ title: "Slip Copied", description: "Text saved to clipboard." })
    }
  }

  const handleShareReceipt = async () => {
    if (!lastTransaction) return
    const text = `*${tenant?.name || 'FreshTally'} Receipt*\n` +
      `ID: ${lastTransaction.id.slice(-6).toUpperCase()}\n` +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      lastTransaction.items.map((item: any) => {
        const isWholesale = item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty
        const price = isWholesale ? item.wholesalePrice : item.price
        return `${item.quantity} ${item.unit || 'x'} ${item.name} - ${formatCurrency(price * item.quantity)}`
      }).join('\n') +
      `\n\n*Total: ${formatCurrency(lastTransaction.total)}*\n` +
      `Paid via ${lastTransaction.paymentType.toUpperCase()}\n\n` +
      `Thank you for your purchase!`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Store Receipt',
          text: text,
        })
      } catch (err) {
        await navigator.clipboard.writeText(text)
        toast({ title: "Receipt Copied", description: "Message saved to clipboard." })
      }
    } else {
      await navigator.clipboard.writeText(text)
      toast({ title: "Receipt Copied", description: "Sharing not supported. Copied to clipboard." })
    }
  }

  if (!mounted || isUserLoading) {
    return (
      <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-24 flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        Initializing Terminal...
      </div>
    )
  }

  if (!user || !profile || !tenant || profile.tenantId !== tenant.id) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-5xl mx-auto relative shadow-2xl">
      <div className="p-4 flex-1 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Sell</h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Tap items to add them</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-10 text-[8px] font-black uppercase text-accent border border-accent/20 rounded-xl"
            onClick={() => db && tenant?.id && runFullSystemAudit(db, tenant.id, cart)}
          >
            <Zap className="h-3 w-3 mr-1" /> Run Audit
          </Button>
        </header>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pos-product-search" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Search Catalog</Label>
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-30 group-focus-within:opacity-100 transition-opacity" />
              <Input 
                id="pos-product-search"
                name="pos-product-search"
                placeholder="Search items by name or SKU..." 
                className="pl-14 h-16 rounded-[28px] border-none bg-white font-bold text-lg shadow-soft focus:bg-white focus:border-primary/20 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
            <Button 
              variant={selectedCategory === "all" ? "default" : "outline"}
              className={cn(
                "h-10 rounded-full px-6 text-[10px] font-black uppercase tracking-widest border-none shrink-0 transition-all",
                selectedCategory === "all" ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white text-muted-foreground shadow-sm"
              )}
              onClick={() => setSelectedCategory("all")}
            >
              All Items
            </Button>
            {tenant?.categories?.map((cat: any) => (
              <Button 
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                className={cn(
                  "h-10 rounded-full px-6 text-[10px] font-black uppercase tracking-widest border-none shrink-0 transition-all",
                  selectedCategory === cat.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white text-muted-foreground shadow-sm"
                )}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.icon} {cat.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Store Catalog</h3>
          {isProductsLoading ? (
            <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Loading Catalog...</div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-24">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[40px] p-12 text-center shadow-inner border border-gray-100">
              <PackageOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-black text-muted-foreground uppercase tracking-tighter">No Products</h3>
            </div>
          )}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="bg-white border-t border-border rounded-t-[48px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] p-8 space-y-6 animate-in slide-in-from-bottom-full duration-500 pb-28">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-xl flex items-center gap-2 tracking-tighter uppercase">
              <ShoppingCart className="h-6 w-6 text-primary" />
              Summary
            </h3>
            <span className="text-[10px] font-black bg-primary text-white px-4 py-1.5 rounded-full uppercase">
              {cart.reduce((sum, i) => sum + i.quantity, 0).toFixed(2).replace(/\.00$/, '')} {cart.length === 1 ? cart[0].unit || 'UNITS' : 'ITEMS'}
            </span>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black uppercase tracking-tight truncate">{item.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    {item.stock} {item.unit || 'UNITS'} left • {formatCurrency(item.price)}/{item.unit || 'U'}
                  </p>
                  {item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty && (
                    <Badge className="bg-green-100 text-green-700 text-[8px] uppercase font-black border-none h-4 px-1.5 mt-1">
                      Bulk Price Applied
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-100 rounded-2xl h-12 px-3">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-primary"><Minus className="h-5 w-5" /></button>
                    <Input 
                      id={`cart-qty-${item.id}`}
                      name={`cart-qty-${item.id}`}
                      className="text-base font-black w-14 text-center bg-transparent border-none focus:ring-0 p-0"
                      value={item.quantity}
                      type="number"
                      step="any"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val)) {
                          setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: val } : i))
                        }
                      }}
                    />
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-primary"><Plus className="h-5 w-5" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-destructive p-3"><Trash2 className="h-6 w-6" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', icon: Banknote, label: 'Cash' },
                { id: 'card', icon: CreditCard, label: 'Card' },
                { id: 'credit', icon: UserCheck, label: 'Store Credit' }
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
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="pos-client-trigger" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Who is buying on credit?</Label>
                  <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
                    <DialogTrigger asChild>
                      <button className="text-[10px] font-black uppercase text-primary flex items-center gap-1 hover:opacity-80 transition-opacity">
                        <UserPlus className="h-3 w-3" /> New Client
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md w-full h-[90vh] rounded-t-[44px] border-none p-0 bg-background overflow-hidden flex flex-col shadow-2xl">
                      <DialogHeader className="p-8 pb-4 bg-primary text-white">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">New Client</DialogTitle>
                        <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-1">Register B2B Account</DialogDescription>
                      </DialogHeader>
                      
                      <form onSubmit={handleSaveClient} className="p-8 space-y-6 overflow-y-auto flex-1 pb-32">
                        <div className="space-y-2">
                          <Label htmlFor="client-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Client / Business Name</Label>
                          <Input 
                            id="client-name"
                            name="client-name"
                            required
                            placeholder="e.g. Sari-Sari Store #1"
                            className="h-16 rounded-2xl bg-gray-100 border-none font-bold text-lg px-6"
                            value={newClientData.name}
                            onChange={(e) => setNewClientData({...newClientData, name: e.target.value})}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="client-type-trigger" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Type</Label>
                          <Select value={newClientData.type} onValueChange={(val) => setNewClientData({...newClientData, type: val})}>
                            <SelectTrigger id="client-type-trigger" name="client-type-trigger" className="h-16 rounded-2xl bg-gray-100 border-none font-bold px-6">
                              <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                              <SelectItem value="Regular" className="font-bold">Regular</SelectItem>
                              <SelectItem value="Wholesale" className="font-bold">Wholesale</SelectItem>
                              <SelectItem value="Staff" className="font-bold">Staff</SelectItem>
                              <SelectItem value="Other" className="font-bold">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="client-phone" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                          <Input 
                            id="client-phone"
                            name="client-phone"
                            placeholder="e.g. 0912 345 6789"
                            className="h-16 rounded-2xl bg-gray-100 border-none font-bold px-6"
                            value={newClientData.phone}
                            onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="client-address" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Delivery Address</Label>
                          <Input 
                            id="client-address"
                            name="client-address"
                            placeholder="Street, Barangay, City"
                            className="h-16 rounded-2xl bg-gray-100 border-none font-bold px-6"
                            value={newClientData.address}
                            onChange={(e) => setNewClientData({...newClientData, address: e.target.value})}
                          />
                        </div>

                        <Button 
                          type="submit" 
                          className="w-full h-20 rounded-[28px] bg-primary text-white font-black text-xl shadow-xl mt-4"
                          disabled={isProcessing}
                        >
                          {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "REGISTER CLIENT"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <Select value={selectedClientId || ""} onValueChange={setSelectedClientId}>
                  <SelectTrigger id="pos-client-trigger" name="pos-client-trigger" className="h-16 rounded-2xl border-none bg-gray-100 font-black uppercase text-xs tracking-widest px-6">
                    <SelectValue placeholder="CHOOSE CLIENT" />
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl border-none shadow-2xl max-h-[300px]">
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id} className="font-bold py-3">{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* TOP SUKI (FREQUENT CLIENTS) */}
                {clients && clients.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Top Suki (Regulars)</p>
                    <div className="flex flex-wrap gap-2">
                      {clients.slice(0, 5).map(client => (
                        <button
                          key={client.id}
                          onClick={() => setSelectedClientId(client.id)}
                          className={cn(
                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2",
                            selectedClientId === client.id 
                              ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                              : "bg-white border-gray-100 text-muted-foreground hover:border-primary/20"
                          )}
                        >
                          {client.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="credit-due-date-btn" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Optional Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        id="credit-due-date-btn"
                        name="credit-due-date-btn"
                        variant="outline" 
                        className="w-full h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold text-left justify-start text-primary"
                      >
                        <CalendarIcon className="mr-2 h-5 w-5" />
                        {creditDueDate ? format(creditDueDate, "PPP") : <span>Set Custom Due Date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl">
                      <Calendar mode="single" selected={creditDueDate} onSelect={setCreditDueDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center px-1">
              <span className="text-muted-foreground font-black text-[10px] uppercase tracking-widest">TOTAL</span>
              <span className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(total)}</span>
            </div>

            <Button 
              className="w-full h-20 rounded-[28px] bg-primary text-white font-black text-2xl shadow-xl active:scale-[0.98] transition-all"
              onClick={handleCheckout}
              disabled={isProcessing}
            >
              {isProcessing ? "PROCESSING..." : `FINISH SALE — ${formatCurrency(total)}`}
            </Button>
          </div>
        </div>
      )}

      <BottomNav />

      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-t-[48px] p-8 space-y-8 animate-in slide-in-from-bottom-full duration-500 shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-20 w-20 bg-primary/10 text-primary rounded-[32px] flex items-center justify-center">
                <Zap className="h-10 w-10 fill-current" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Sale Confirmed</h2>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">Transaction ID: {lastTransaction.id.slice(-6).toUpperCase()}</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-[32px] p-8 space-y-6 border-2 border-dashed border-gray-200">
              <div className="space-y-3">
                {lastTransaction.items.map((item: any, i: number) => {
                  const isWholesale = item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty
                  const price = isWholesale ? item.wholesalePrice : item.price
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <div className="flex justify-between text-sm font-bold uppercase tracking-tight">
                        <span>{item.quantity} {item.unit || 'x'} {item.name}</span>
                        <span>{formatCurrency(price * item.quantity)}</span>
                      </div>
                      {isWholesale && (
                        <span className="text-[8px] font-black text-green-600 uppercase tracking-widest leading-none">Wholesale Discount Applied</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest">Total Amount</span>
                <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(lastTransaction.total)}</span>
              </div>
              <div className="text-center">
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.3em]">Paid via {lastTransaction.paymentType}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-16 rounded-[24px] border-2 border-gray-100 font-black uppercase tracking-widest text-[10px]"
                onClick={() => setShowReceipt(false)}
              >
                Dismiss
              </Button>
              <Button 
                className="h-16 rounded-[24px] bg-primary font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                onClick={lastTransaction.paymentType === 'credit' ? handleShareCreditSlip : handleShareReceipt}
              >
                <Share2 className="h-4 w-4 mr-2" /> 
                {lastTransaction.paymentType === 'credit' ? "Share Credit Slip" : "Share Receipt"}
              </Button>
            </div>
            
            <Button 
              variant="ghost"
              className="w-full text-[8px] font-black uppercase opacity-40 hover:opacity-100"
              onClick={() => {
                toast({ title: "Coming Soon", description: "Cloud Printing integration in development." })
              }}
            >
              Print Thermal Receipt
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
