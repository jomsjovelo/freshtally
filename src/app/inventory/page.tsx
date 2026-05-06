"use client"

import { useState, useMemo } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Filter, AlertTriangle, MoreVertical, PackageOpen, Loader2, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn, formatCurrency } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export default function InventoryPage() {
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { tenant } = useUser()
  const db = useFirestore()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    price: "",
    stock: "",
    minStock: "10"
  })

  const inventoryQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "products"),
      orderBy("name", "asc"),
      limit(100)
    )
  }, [db, tenant?.id])

  const { data: inventory, isLoading } = useCollection(inventoryQuery)

  const filteredInventory = useMemo(() => {
    if (!inventory) return []
    return inventory.filter(i => 
      i.name.toLowerCase().includes(search.toLowerCase()) || 
      i.sku?.toLowerCase().includes(search.toLowerCase())
    )
  }, [inventory, search])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || isSaving) return
    
    setIsSaving(true)
    try {
      await addDoc(collection(db, "tenants", tenant.id, "products"), {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
        tenantId: tenant.id,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      toast({ title: "Product Created", description: "Inventory synchronized." })
      setIsAddOpen(false)
      setFormData({ name: "", sku: "", price: "", stock: "", minStock: "10" })
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-8 pb-32">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-primary">Registry</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-2">Catalog Control</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-16 w-16 rounded-[28px] bg-accent hover:bg-accent/90 shadow-xl shadow-accent/20 transition-all active:scale-95">
              <Plus className="h-8 w-8 text-white" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-full h-[90vh] rounded-t-[44px] border-none p-0 bg-white overflow-hidden flex flex-col shadow-2xl">
            <DialogHeader className="p-10 pb-6 bg-gradient-to-br from-accent to-accent/80 text-white relative">
              <div className="absolute top-0 right-0 p-10 opacity-10">
                <Plus className="h-24 w-24" />
              </div>
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter">New Product</DialogTitle>
              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Initialize Store SKU</p>
            </DialogHeader>
            
            <form onSubmit={handleSave} className="p-10 space-y-8 overflow-y-auto flex-1 pb-32">
              <div className="space-y-3">
                <Label htmlFor="inventory-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Product Identity</Label>
                <Input 
                  id="inventory-name"
                  name="inventory-name"
                  required
                  placeholder="e.g. Arabica Coffee Beans"
                  className="h-16 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-accent/20 focus:ring-0 transition-all font-bold text-lg px-6"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  autoComplete="off"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="inventory-sku" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">SKU Code</Label>
                  <Input 
                    id="inventory-sku"
                    name="inventory-sku"
                    required
                    placeholder="COF-001"
                    className="h-16 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-accent/20 focus:ring-0 transition-all font-bold px-6"
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="inventory-price" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Unit Price (₱)</Label>
                  <Input 
                    id="inventory-price"
                    name="inventory-price"
                    required
                    type="number"
                    placeholder="0.00"
                    className="h-16 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-accent/20 focus:ring-0 transition-all font-bold px-6"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="inventory-stock" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Opening Stock</Label>
                  <Input 
                    id="inventory-stock"
                    name="inventory-stock"
                    required
                    type="number"
                    placeholder="0"
                    className="h-16 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-accent/20 focus:ring-0 transition-all font-bold px-6"
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="inventory-min-stock" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Critical Level</Label>
                  <Input 
                    id="inventory-min-stock"
                    name="inventory-min-stock"
                    required
                    type="number"
                    className="h-16 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-accent/20 focus:ring-0 transition-all font-bold px-6"
                    value={formData.minStock}
                    onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                    autoComplete="off"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-20 rounded-[32px] bg-accent text-white font-black text-xl shadow-xl shadow-accent/20 mt-6 active:scale-[0.98] transition-all hover:shadow-accent/30"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                  <div className="flex items-center gap-3">
                    COMMIT TO LEDGER <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-40 group-focus-within:opacity-100 transition-opacity" />
          <Input 
            id="inventory-search"
            name="inventory-search"
            placeholder="Search catalog..." 
            className="pl-14 h-16 bg-white border-transparent shadow-soft rounded-[28px] font-bold text-lg focus:bg-white focus:border-primary/10 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between px-2">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Stock Monitoring</p>
          <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary">Live Sync</Badge>
        </div>
        
        {isLoading ? (
          <div className="p-24 text-center animate-pulse font-black text-muted-foreground uppercase tracking-[0.2em] text-[10px]">Scanning Registry...</div>
        ) : filteredInventory.length > 0 ? (
          <div className="grid gap-5">
            {filteredInventory.map((item) => {
              const minStock = item.minStock || 10
              const isLowStock = item.stock <= minStock
              const stockPercent = (item.stock / (minStock * 2)) * 100
              
              return (
                <div key={item.id} className="bg-white p-7 rounded-[40px] shadow-soft border border-gray-50/50 flex flex-col gap-6 relative overflow-hidden group hover:border-primary/20 transition-all active:scale-[0.99]">
                  {isLowStock && (
                    <div className="absolute top-6 right-6">
                      <Badge variant="destructive" className="animate-pulse flex gap-1.5 items-center px-3 py-1.5 text-[9px] uppercase font-black rounded-xl">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        CRITICAL
                      </Badge>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className="font-black text-xl uppercase tracking-tight text-foreground leading-none truncate">{item.name}</h3>
                      <p className="text-[10px] font-black text-muted-foreground mt-3 uppercase tracking-widest flex items-center gap-2">
                        <span className="bg-gray-100 px-2 py-0.5 rounded-md">{item.sku}</span>
                        <span className="text-primary">{formatCurrency(item.price)} / UNIT</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-[0.2em]">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-muted-foreground opacity-60">QUANTITY ON HAND</span>
                        <span className={cn("text-lg tracking-normal", isLowStock ? "text-destructive" : "text-primary")}>
                          {item.stock} UNITS
                        </span>
                      </div>
                      <span className="text-muted-foreground opacity-40 mb-1">REORDER AT {minStock}</span>
                    </div>
                    <div className="h-3 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100/50">
                      <div 
                        className={cn("h-full transition-all duration-1000", isLowStock ? "bg-destructive" : "bg-primary")} 
                        style={{ width: `${Math.min(stockPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-[44px] p-20 text-center border-2 border-dashed border-gray-100 shadow-inner">
            <div className="h-20 w-20 bg-gray-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
              <PackageOpen className="h-10 w-10 text-muted-foreground opacity-20" />
            </div>
            <h3 className="text-xl font-black text-muted-foreground uppercase tracking-tighter">Registry Empty</h3>
            <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest mt-2">Initialize your first product</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
