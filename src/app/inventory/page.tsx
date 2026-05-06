
"use client"

import { useState, useMemo } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Filter, AlertTriangle, MoreVertical, PackageOpen, X, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn, formatCurrency } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore"
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

  // Form State
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
      
      toast({ title: "Product Added", description: `${formData.name} is now in inventory.` })
      setIsAddOpen(false)
      setFormData({ name: "", sku: "", price: "", stock: "", minStock: "10" })
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-none text-primary">Inventory</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Live Stock Monitoring</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-3xl bg-accent hover:bg-accent/90 shadow-xl">
              <Plus className="h-7 w-7" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-full h-[90vh] rounded-t-[40px] border-none p-0 bg-background overflow-hidden flex flex-col">
            <DialogHeader className="p-8 pb-4 bg-accent text-white">
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter">New Product</DialogTitle>
              <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Add to your catalog</p>
            </DialogHeader>
            
            <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto flex-1 pb-32">
              <div className="space-y-2">
                <Label htmlFor="productName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Product Name</Label>
                <Input 
                  id="productName"
                  name="productName"
                  required
                  placeholder="e.g. Arabica Coffee Beans"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-bold text-lg"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">SKU / Code</Label>
                  <Input 
                    id="sku"
                    name="sku"
                    required
                    placeholder="COF-001"
                    className="h-16 rounded-2xl bg-gray-100 border-none font-bold"
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitPrice" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Unit Price (₱)</Label>
                  <Input 
                    id="unitPrice"
                    name="unitPrice"
                    required
                    type="number"
                    placeholder="0.00"
                    className="h-16 rounded-2xl bg-gray-100 border-none font-bold"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Initial Stock</Label>
                  <Input 
                    id="stock"
                    name="stock"
                    required
                    type="number"
                    placeholder="0"
                    className="h-16 rounded-2xl bg-gray-100 border-none font-bold"
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Min. Alert Level</Label>
                  <Input 
                    id="minStock"
                    name="minStock"
                    required
                    type="number"
                    className="h-16 rounded-2xl bg-gray-100 border-none font-bold"
                    value={formData.minStock}
                    onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-20 rounded-[28px] bg-accent text-white font-black text-xl shadow-xl mt-4"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : "CREATE PRODUCT"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            id="inventorySearch"
            name="inventorySearch"
            placeholder="Search SKUs or Names..." 
            className="pl-12 h-14 bg-gray-100 border-none shadow-sm rounded-2xl font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-14 w-14 p-0 border-none bg-gray-100 rounded-2xl">
          <Filter className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Scanning Warehouse...</div>
        ) : filteredInventory.length > 0 ? (
          filteredInventory.map((item) => {
            const minStock = item.minStock || 10
            const isLowStock = item.stock <= minStock
            const stockPercent = (item.stock / (minStock * 2)) * 100
            
            return (
              <div key={item.id} className="bg-card p-6 rounded-[32px] shadow-sm border-none flex flex-col gap-4 relative overflow-hidden group">
                {isLowStock && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="destructive" className="animate-pulse flex gap-1 items-center px-2 py-1 text-[9px] uppercase font-black rounded-lg">
                      <AlertTriangle className="h-3 w-3" />
                      CRITICAL
                    </Badge>
                  </div>
                )}
                
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-black text-lg uppercase tracking-tight text-foreground leading-none">{item.name}</h3>
                    <p className="text-[10px] font-black text-muted-foreground mt-2 uppercase tracking-widest">
                      {item.sku} • {formatCurrency(item.price)}
                    </p>
                  </div>
                  <button className="text-muted-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className={isLowStock ? "text-destructive" : "text-primary"}>
                      {item.stock} UNITS
                    </span>
                    <span className="text-muted-foreground opacity-60">MIN: {minStock}</span>
                  </div>
                  <Progress 
                    value={Math.min(stockPercent, 100)} 
                    className={cn("h-3 rounded-full", isLowStock ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")} 
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest rounded-2xl bg-gray-50 border-none text-primary">
                    ADJUST
                  </Button>
                  <Button variant="outline" className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest rounded-2xl border-2 border-gray-100">
                    RESTOCK
                  </Button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="bg-gray-50 rounded-[40px] p-12 text-center border-2 border-dashed border-gray-200">
            <PackageOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-black text-muted-foreground uppercase tracking-tighter">Empty shelves</h3>
            <p className="text-[10px] font-black text-muted-foreground uppercase mt-2 tracking-widest">Add products to start tracking</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
