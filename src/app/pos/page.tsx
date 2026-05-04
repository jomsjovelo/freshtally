
"use client"

import { useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

const MOCK_PRODUCTS = [
  { id: 1, name: "Premium Coffee Beans", price: 18.50, category: "Beans" },
  { id: 2, name: "Paper Cups (100pk)", price: 12.00, category: "Supplies" },
  { id: 3, name: "Vanilla Syrup", price: 8.50, category: "Flavorings" },
  { id: 4, name: "Chocolate Muffin", price: 3.25, category: "Food" },
  { id: 5, name: "Almond Milk 1L", price: 4.50, category: "Dairy" },
]

export default function POSPage() {
  const [cart, setCart] = useState<any[]>([])
  const [search, setSearch] = useState("")
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

  const handleCheckout = (method: string) => {
    toast({
      title: "Transaction Complete",
      description: `Payment of $${total.toFixed(2)} via ${method} processed successfully.`,
    })
    setCart([])
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 flex-1 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">POS Terminal</h1>
          <Badge variant="secondary" className="bg-primary/10 text-primary">Terminal #01</Badge>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search items or scan barcode..." 
            className="pl-10 h-12 bg-white/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">Products</h3>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((product) => (
              <button 
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-card p-3 rounded-xl shadow-sm border border-transparent active:border-primary active:bg-primary/5 transition-all text-left"
              >
                <p className="font-bold text-sm truncate">{product.name}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-primary font-bold text-xs">${product.price.toFixed(2)}</span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {cart.length > 0 && (
        <div className="bg-white border-t border-border rounded-t-3xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)] p-6 space-y-4 animate-in slide-in-from-bottom-full duration-500 pb-24">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Your Cart
            </h3>
            <span className="text-muted-foreground text-sm">{cart.length} items</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} / unit</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-secondary rounded-full h-8 px-1">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-primary"><Minus className="h-3 w-3" /></button>
                    <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-primary"><Plus className="h-3 w-3" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex justify-between items-center mb-6">
              <span className="text-muted-foreground font-medium">Grand Total</span>
              <span className="text-2xl font-bold text-primary">${total.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-14 rounded-xl border-2 border-primary/20 text-primary font-bold"
                onClick={() => handleCheckout("Cash")}
              >
                <Banknote className="h-5 w-5 mr-2" />
                CASH
              </Button>
              <Button 
                className="h-14 rounded-xl bg-primary text-white font-bold"
                onClick={() => handleCheckout("Card")}
              >
                <CreditCard className="h-5 w-5 mr-2" />
                CARD
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
