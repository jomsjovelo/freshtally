
"use client"

import { useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, cn } from "@/lib/utils"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"

const MOCK_PRODUCTS = [
  { id: 1, name: "Barako Gold Roast", price: 250.00, category: "Beans" },
  { id: 2, name: "Eco-Cup (S)", price: 15.00, category: "Supplies" },
  { id: 3, name: "Muscovado Syrup", price: 120.00, category: "Flavorings" },
  { id: 4, name: "Ube Cheese Pandesal", price: 45.00, category: "Food" },
  { id: 5, name: "Soy Milk 1L", price: 185.00, category: "Dairy" },
]

const MOCK_B2B_CLIENTS = [
  { id: "c1", name: "Starbucks Corp" },
  { id: "c2", name: "Ayala Mall Operations" },
  { id: "c3", name: "BGC Security Services" },
]

export default function POSPage() {
  const [cart, setCart] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'credit'>('cash')
  const { toast } = useToast()

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter(item => item.id !== id))
  }

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty }
      }
      return item
    }))
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const handleCheckout = () => {
    if (paymentType === 'credit' && !selectedClientId) {
      toast({
        title: "Account Required",
        description: "Please select a B2B client for credit charges.",
        variant: "destructive",
      })
      return
    }

    const clientName = MOCK_B2B_CLIENTS.find(c => c.id === selectedClientId)?.name
    
    toast({
      title: "Transaction Complete",
      description: `Payment of ${formatCurrency(total)} via ${paymentType.toUpperCase()} ${clientName ? `charged to ${clientName}` : ""} processed.`,
    })
    setCart([])
    setSelectedClientId(null)
    setPaymentType('cash')
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <div className="p-4 flex-1 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-black text-primary uppercase tracking-tighter">POS Terminal</h1>
          <Badge variant="secondary" className="bg-primary/10 text-primary rounded-full px-4 h-8 font-bold">Terminal #01</Badge>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search items..." 
            className="pl-10 h-14 bg-white border-none shadow-sm rounded-2xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Daily Inventory</h3>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((product) => (
              <button 
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white p-4 rounded-3xl shadow-sm border border-transparent active:scale-[0.97] active:bg-primary/5 transition-all text-left"
              >
                <p className="font-bold text-sm leading-tight h-10 line-clamp-2">{product.name}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-primary font-black text-xs">{formatCurrency(product.price)}</span>
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {cart.length > 0 && (
        <div className="bg-white border-t border-border rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] p-6 space-y-6 animate-in slide-in-from-bottom-full duration-500 pb-24">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Cart Items
            </h3>
            <span className="text-xs font-bold bg-secondary px-3 py-1 rounded-full">{cart.length} items</span>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-secondary rounded-full h-10 px-2">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-primary"><Minus className="h-4 w-4" /></button>
                    <span className="text-sm font-black w-8 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-primary"><Plus className="h-4 w-4" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-destructive p-2 hover:bg-destructive/5 rounded-full transition-colors"><Trash2 className="h-5 w-5" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', icon: Banknote, label: 'Cash' },
                { id: 'card', icon: CreditCard, label: 'Card' },
                { id: 'credit', icon: UserCheck, label: 'Credit' }
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setPaymentType(type.id as any)}
                  className={cn(
                    "flex flex-col items-center justify-center h-20 rounded-2xl border-2 transition-all gap-1",
                    paymentType === type.id 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-secondary bg-transparent text-muted-foreground"
                  )}
                >
                  <type.icon className="h-5 w-5" />
                  <span className="text-[10px] font-black uppercase">{type.label}</span>
                </button>
              ))}
            </div>

            {paymentType === 'credit' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <Select onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-14 rounded-xl border-none bg-secondary/50 font-bold">
                    <SelectValue placeholder="Select B2B Client" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    {MOCK_B2B_CLIENTS.map(client => (
                      <SelectItem key={client.id} value={client.id} className="font-bold">{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-between items-center px-1">
              <span className="text-muted-foreground font-bold text-sm">TOTAL AMOUNT</span>
              <span className="text-3xl font-black text-primary">{formatCurrency(total)}</span>
            </div>

            <Button 
              className="w-full h-16 rounded-3xl bg-primary text-white font-black text-xl shadow-xl active:scale-[0.98] transition-all"
              onClick={handleCheckout}
            >
              COMPLETE ORDER
            </Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
