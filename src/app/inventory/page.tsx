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
import { collection, query, orderBy, limit, addDoc, serverTimestamp, updateDoc, doc, increment, writeBatch } from "firebase/firestore"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { predictRestock } from "@/ai/flows/predictive-restock-flow"
import { getDocs, where, Timestamp } from "firebase/firestore"
import { Sparkles } from "lucide-react"
import { ProductSchema } from "@/lib/schemas"

export default function InventoryPage() {
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRestockOpen, setIsRestockOpen] = useState(false)
  const [restockUpdates, setRestockUpdates] = useState<Record<string, string>>({})
  const { tenant } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [isAiLoading, setIsAiLoading] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<any>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [isSpoilageOpen, setIsSpoilageOpen] = useState(false)
  const [spoilageData, setSpoilageData] = useState({ qty: "", reason: "", unit: "base" })

  const SPOILAGE_REASONS = [
    "Overripe / Rotten",
    "Damaged",
    "Expired",
    "Quality Issue",
    "Other"
  ]

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    price: "",
    costPrice: "",
    unit: "kg",
    stock: "",
    minStock: "10",
    wholesalePrice: "",
    wholesaleMinQty: "",
    categoryId: ""
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

  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const filteredInventory = useMemo(() => {
    if (!inventory) return []
    return inventory.filter(i => {
      const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) || 
                           i.sku?.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === "all" || i.categoryId === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [inventory, search, selectedCategory])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tenant?.id || isSaving) return
    
    setIsSaving(true)
    const finalSku = formData.sku || `FT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const validation = ProductSchema.safeParse({
      ...formData,
      sku: finalSku,
      tenantId: tenant.id
    })

    if (!validation.success) {
      toast({ 
        title: "Validation Error", 
        description: validation.error.errors[0].message, 
        variant: "destructive" 
      })
      setIsSaving(false)
      return
    }

    try {
      await addDoc(collection(db, "tenants", tenant.id, "products"), {
        ...validation.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      toast({ title: "Product Created", description: "Inventory synchronized." })
      setIsAddOpen(false)
      setFormData({ 
        name: "", 
        sku: "", 
        price: "", 
        costPrice: "", 
        unit: "kg", 
        stock: "", 
        minStock: "10",
        wholesalePrice: "",
        wholesaleMinQty: "",
        categoryId: ""
      })
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tenant?.id || !selectedProduct || isSaving) return
    
    setIsSaving(true)
    const validation = ProductSchema.safeParse({
      ...formData,
      tenantId: tenant.id
    })

    if (!validation.success) {
      toast({ 
        title: "Validation Error", 
        description: validation.error.errors[0].message, 
        variant: "destructive" 
      })
      setIsSaving(false)
      return
    }

    try {
      const productRef = doc(db, "tenants", tenant.id, "products", selectedProduct.id)
      
      // Calculate delta for stock to avoid overwriting concurrent sales
      const stockDelta = validation.data.stock - selectedProduct.stock

      await updateDoc(productRef, {
        ...validation.data,
        stock: increment(stockDelta),
        updatedAt: serverTimestamp()
      })
      
      toast({ title: "Product Updated", description: "Changes saved to catalog." })
      setIsEditOpen(false)
      setSelectedProduct(null)
      setFormData({ 
        name: "", 
        sku: "", 
        price: "", 
        costPrice: "", 
        unit: "kg", 
        stock: "", 
        minStock: "10",
        wholesalePrice: "",
        wholesaleMinQty: "",
        categoryId: ""
      })
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogSpoilage = async (e: React.FormEvent) => {
    e.preventDefault()
    let rawQty = Number(spoilageData.qty)
    if (!db || !tenant?.id || !selectedProduct || rawQty <= 0 || isSaving) return
    
    // Smart math: Convert grams to kilograms if g is selected
    const finalQty = spoilageData.unit === "g" ? rawQty / 1000 : rawQty
    
    // Safety check: Stock capping
    if (finalQty > selectedProduct.stock) {
      toast({ title: "Quantity Error", description: "Cannot log more than current stock.", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      const batch = writeBatch(db)
      const productRef = doc(db, "tenants", tenant.id, "products", selectedProduct.id)
      batch.update(productRef, { 
        stock: increment(-finalQty),
        updatedAt: serverTimestamp()
      })
      
      const lossAmount = Math.round((finalQty * (selectedProduct.costPrice || 0)) * 100) / 100
      const expenseRef = doc(collection(db, "tenants", tenant.id, "expenses"))
      batch.set(expenseRef, {
        description: `Loss: ${finalQty.toFixed(3).replace(/\.?0+$/, '')} ${selectedProduct.unit} of ${selectedProduct.name}`,
        amount: lossAmount,
        category: "Wastage",
        notes: spoilageData.reason || "Inventory spoilage",
        tenantId: tenant.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      await batch.commit()
      toast({ title: "Spoilage Logged", description: `${formatCurrency(lossAmount)} recorded as wastage.` })
      setIsSpoilageOpen(false)
      setSpoilageData({ qty: "", reason: "", unit: "base" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePredict = async (item: any) => {
    if (!db || !tenant?.id) return
    setIsAiLoading(item.id)
    
    try {
      // Fetch last 7 days of transactions to calculate velocity
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const txQuery = query(
        collection(db, "tenants", tenant.id, "transactions"),
        where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo))
      )
      
      const snap = await getDocs(txQuery)
      const salesByDay = [0, 0, 0, 0, 0, 0, 0]
      
      snap.forEach(doc => {
        const data = doc.data()
        const txDate = data.createdAt.toDate()
        const dayIdx = Math.floor((new Date().getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24))
        if (dayIdx >= 0 && dayIdx < 7) {
          const productInTx = data.items?.find((i: any) => i.id === item.id)
          if (productInTx) {
            salesByDay[dayIdx] += productInTx.quantity
          }
        }
      })

      const result = await predictRestock({
        productName: item.name,
        currentStock: item.stock,
        minStock: item.minStock || 10,
        salesVelocity: salesByDay.reverse()
      })

      setPrediction({ ...result, productName: item.name })
    } catch (err: any) {
      console.error(err)
      toast({ title: "Prediction Failed", description: "Could not generate AI forecast.", variant: "destructive" })
    } finally {
      setIsAiLoading(null)
    }
  }

  return (
    <div className="p-6 space-y-8 pb-32 max-w-5xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-primary">My Items</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-2">Your product list</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isRestockOpen} onOpenChange={setIsRestockOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-16 px-6 rounded-[28px] border-2 border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/5">
                Morning Restock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md w-full h-[100vh] rounded-none border-none p-0 bg-white overflow-hidden flex flex-col shadow-2xl">
              <DialogHeader className="p-10 pb-6 bg-primary text-white relative">
                <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Morning Restock</DialogTitle>
                <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Update today's inventory</DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-40">
                {inventory?.map(item => (
                  <div key={item.id} className="bg-gray-50 p-6 rounded-[32px] flex items-center justify-between gap-4 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm uppercase truncate">{item.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Current: {item.stock} {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`restock-qty-${item.id}`} className="sr-only">Restock Quantity for {item.name}</Label>
                      <span className="text-xl font-black text-primary/30">+</span>
                      <Input 
                        id={`restock-qty-${item.id}`}
                        name={`restock-qty-${item.id}`}
                        type="number"
                        placeholder="0"
                        className="h-14 w-24 rounded-2xl bg-white border-transparent text-center font-black text-lg focus:border-primary/20 transition-all"
                        value={restockUpdates[item.id] || ""}
                        onChange={(e) => setRestockUpdates({...restockUpdates, [item.id]: e.target.value})}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-lg border-t border-gray-100">
                <Button 
                  className="w-full h-20 rounded-[32px] bg-primary text-white font-black text-xl shadow-xl"
                  onClick={async () => {
                    if (!db || !tenant?.id) return
                    setIsSaving(true)
                    try {
                      const batch = writeBatch(db)
                      Object.entries(restockUpdates).forEach(([id, qty]) => {
                        const amount = Number(qty)
                        if (amount > 0) {
                          const ref = doc(db, "tenants", tenant.id, "products", id)
                          batch.update(ref, { stock: increment(amount), updatedAt: serverTimestamp() })
                        }
                      })
                      await batch.commit()
                      toast({ title: "Restock Complete", description: "Daily inventory updated." })
                      setIsRestockOpen(false)
                      setRestockUpdates({})
                    } catch (err: any) {
                      toast({ title: "Restock Failed", description: err.message, variant: "destructive" })
                    } finally {
                      setIsSaving(false)
                    }
                  }}
                  disabled={isSaving || Object.keys(restockUpdates).length === 0}
                >
                  {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : "FINISH RESTOCK"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Add New Item</DialogTitle>
              <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Initialize Store SKU</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSave} className="p-10 space-y-8 overflow-y-auto flex-1 pb-32">
              <div className="space-y-3">
                <Label htmlFor="inventory-category-trigger" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Category</Label>
                <Select value={formData.categoryId} onValueChange={(val) => setFormData({...formData, categoryId: val})}>
                  <SelectTrigger id="inventory-category-trigger" name="inventory-category-trigger" className="h-16 rounded-2xl bg-gray-50 border-transparent font-bold px-6">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="none" className="font-bold">No Category</SelectItem>
                    {tenant?.categories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id} className="font-bold">{cat.icon} {cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  <Label htmlFor="inventory-sku" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Item Code (Optional)</Label>
                  <Input 
                    id="inventory-sku"
                    name="inventory-sku"
                    placeholder="e.g. COF-001"
                    className="h-16 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-accent/20 focus:ring-0 transition-all font-bold px-6"
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="inventory-price" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Selling Price (₱)</Label>
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
                  <Label htmlFor="inventory-cost" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Cost Price (₱)</Label>
                  <Input 
                    id="inventory-cost"
                    name="inventory-cost"
                    required
                    type="number"
                    placeholder="0.00"
                    className="h-16 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-accent/20 focus:ring-0 transition-all font-bold px-6"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({...formData, costPrice: e.target.value})}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="inventory-unit-trigger" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Unit of Measure</Label>
                  <Select value={formData.unit} onValueChange={(val) => setFormData({...formData, unit: val})}>
                    <SelectTrigger id="inventory-unit-trigger" name="inventory-unit-trigger" className="h-16 rounded-2xl bg-gray-50 border-transparent font-bold px-6">
                      <SelectValue placeholder="Select Unit" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      <SelectItem value="kg" className="font-bold">Kilogram (kg)</SelectItem>
                      <SelectItem value="g" className="font-bold">Gram (g)</SelectItem>
                      <SelectItem value="pcs" className="font-bold">Pieces (pcs)</SelectItem>
                      <SelectItem value="bundle" className="font-bold">Bundle</SelectItem>
                      <SelectItem value="box" className="font-bold">Box</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-accent/5 p-6 rounded-3xl space-y-4 border border-accent/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent">Wholesale Settings (Optional)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inventory-wholesale-price" className="text-[9px] font-black uppercase tracking-widest opacity-60">Wholesale Price</Label>
                    <Input 
                      id="inventory-wholesale-price"
                      name="inventory-wholesale-price"
                      type="number"
                      placeholder="0.00"
                      className="h-12 rounded-xl bg-white border-transparent font-bold px-4"
                      value={formData.wholesalePrice}
                      onChange={(e) => setFormData({...formData, wholesalePrice: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inventory-wholesale-qty" className="text-[9px] font-black uppercase tracking-widest opacity-60">Min. Wholesale Qty</Label>
                    <Input 
                      id="inventory-wholesale-qty"
                      name="inventory-wholesale-qty"
                      type="number"
                      placeholder="e.g. 10"
                      className="h-12 rounded-xl bg-white border-transparent font-bold px-4"
                      value={formData.wholesaleMinQty}
                      onChange={(e) => setFormData({...formData, wholesaleMinQty: e.target.value})}
                    />
                  </div>
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
                  <Label htmlFor="inventory-min-stock" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Low Stock Alert</Label>
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
                    SAVE ITEM <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </header>

      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="inventory-search-registry" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Search Registry</Label>
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-30" />
            <Input 
              id="inventory-search-registry"
              name="inventory-search-registry"
              placeholder="Search product registry..." 
              className="pl-14 h-16 rounded-[28px] border-none bg-white font-bold text-lg shadow-soft"
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
              selectedCategory === "all" ? "bg-primary text-white" : "bg-white text-muted-foreground shadow-sm"
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
                selectedCategory === cat.id ? "bg-primary text-white" : "bg-white text-muted-foreground shadow-sm"
              )}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.icon} {cat.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Store Catalog</h3>
        {isLoading ? (
          <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Loading Catalog...</div>
        ) : filteredInventory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredInventory.map((item) => {
              const minStock = item.minStock || 10
              const isLowStock = item.stock <= minStock
              const stockPercent = (item.stock / (minStock * 2)) * 100
              
              return (
                <div 
                  key={item.id} 
                  className="bg-white p-7 rounded-[40px] shadow-soft border border-gray-50/50 flex flex-col gap-6 relative overflow-hidden group hover:border-primary/20 transition-all active:scale-[0.99]"
                  onClick={() => {
                    setSelectedProduct(item)
                    setFormData({
                      name: item.name,
                      sku: item.sku || "",
                      price: item.price.toString(),
                      costPrice: (item.costPrice || "").toString(),
                      unit: item.unit || "kg",
                      stock: item.stock.toString(),
                      minStock: (item.minStock || 10).toString(),
                      wholesalePrice: (item.wholesalePrice || "").toString(),
                      wholesaleMinQty: (item.wholesaleMinQty || "").toString(),
                      categoryId: item.categoryId || ""
                    })
                    setIsEditOpen(true)
                  }}
                >
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
                        <span className="text-primary">{formatCurrency(item.price)} / {item.unit || 'UNIT'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-[0.2em]">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-muted-foreground opacity-60">QUANTITY ON HAND</span>
                        <span className={cn("text-lg tracking-normal", isLowStock ? "text-destructive" : "text-primary")}>
                          {item.stock} {item.unit?.toUpperCase() || 'UNITS'}
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

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 h-12 rounded-2xl bg-primary/5 border-none text-[10px] font-black uppercase text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePredict(item)
                        }}
                        disabled={!!isAiLoading}
                      >
                        {isAiLoading === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        AI Predict
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="flex-1 h-12 rounded-2xl bg-destructive/5 text-destructive text-[10px] font-black uppercase hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProduct(item)
                          setIsSpoilageOpen(true)
                        }}
                      >
                        Report Spoilage
                      </Button>
                    </div>

                  <Dialog open={!!prediction} onOpenChange={(open) => !open && setPrediction(null)}>
                    <DialogContent className="max-w-md w-[90%] rounded-[40px] border-none p-0 bg-background overflow-hidden shadow-2xl">
                      <DialogHeader className="p-8 pb-6 bg-gradient-to-br from-primary to-primary/80 text-white">
                        <div className="flex items-center gap-3">
                          <Sparkles className="h-6 w-6" />
                          <DialogTitle className="text-xl font-black uppercase tracking-tighter">AI Inventory Insight</DialogTitle>
                        </div>
                        <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">{prediction?.productName}</p>
                      </DialogHeader>
                      
                      <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Stockout In</p>
                            <p className="text-2xl font-black text-primary">{prediction?.forecastDays} Days</p>
                          </div>
                          <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Order Qty</p>
                            <p className="text-2xl font-black text-accent">{prediction?.recommendedQuantity} Units</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-muted-foreground uppercase ml-1">AI Reasoning</p>
                          <div className="bg-gray-50 p-6 rounded-3xl text-xs font-medium leading-relaxed border border-gray-100 italic text-muted-foreground">
                            "{prediction?.reasoning}"
                          </div>
                        </div>

                        <div className="flex items-center gap-3 bg-destructive/5 p-4 rounded-2xl border border-destructive/10">
                          <AlertTriangle className={cn("h-5 w-5", prediction?.urgency === 'critical' ? 'text-destructive animate-pulse' : 'text-orange-500')} />
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground">
                            Priority: <span className={cn(prediction?.urgency === 'critical' ? 'text-destructive' : 'text-orange-500')}>{prediction?.urgency}</span>
                          </p>
                        </div>

                        <Button className="w-full h-16 rounded-2xl bg-primary text-white font-black uppercase shadow-lg shadow-primary/20" onClick={() => setPrediction(null)}>
                          ACKNOWLEDGE
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
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

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md w-full h-[90vh] rounded-t-[40px] border-none p-0 bg-background overflow-hidden flex flex-col">
          <DialogHeader className="p-8 pb-4 bg-primary text-white">
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Edit Product</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdate} className="p-8 space-y-6 overflow-y-auto flex-1 pb-32">
            <div className="space-y-2">
              <Label htmlFor="edit-category-trigger" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
              <Select value={formData.categoryId} onValueChange={(val) => setFormData({...formData, categoryId: val})}>
                <SelectTrigger id="edit-category-trigger" name="edit-category-trigger" className="h-16 rounded-2xl bg-gray-100 border-none font-bold px-6">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="none" className="font-bold">No Category</SelectItem>
                  {tenant?.categories?.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id} className="font-bold">{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-product-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Product Name</Label>
              <Input 
                id="edit-product-name"
                name="edit-product-name"
                required
                className="h-16 rounded-2xl bg-gray-100 border-none font-bold text-lg px-6"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                autoComplete="off"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-product-price" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Selling Price (₱)</Label>
                <Input 
                  id="edit-product-price"
                  name="edit-product-price"
                  required
                  type="number"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-black text-xl px-6"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-cost" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cost Price (₱)</Label>
                <Input 
                  id="edit-product-cost"
                  name="edit-product-cost"
                  required
                  type="number"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-black text-xl px-6"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({...formData, costPrice: e.target.value})}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-unit-trigger" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Unit of Measure</Label>
                <Select value={formData.unit} onValueChange={(val) => setFormData({...formData, unit: val})}>
                  <SelectTrigger id="edit-unit-trigger" name="edit-unit-trigger" className="h-16 rounded-2xl bg-gray-100 border-none font-bold px-6">
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="kg" className="font-bold">Kilogram (kg)</SelectItem>
                    <SelectItem value="g" className="font-bold">Gram (g)</SelectItem>
                    <SelectItem value="pcs" className="font-bold">Pieces (pcs)</SelectItem>
                    <SelectItem value="bundle" className="font-bold">Bundle</SelectItem>
                    <SelectItem value="box" className="font-bold">Box</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-sku" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">SKU / Code</Label>
                <Input 
                  id="edit-product-sku"
                  name="edit-product-sku"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-bold px-6"
                  value={formData.sku}
                  onChange={(e) => setFormData({...formData, sku: e.target.value})}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-wholesale-price" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Wholesale Price</Label>
                <Input 
                  id="edit-wholesale-price"
                  name="edit-wholesale-price"
                  type="number"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-black text-xl px-6"
                  value={formData.wholesalePrice}
                  onChange={(e) => setFormData({...formData, wholesalePrice: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-wholesale-qty" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Wholesale Qty</Label>
                <Input 
                  id="edit-wholesale-qty"
                  name="edit-wholesale-qty"
                  type="number"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-black text-xl px-6"
                  value={formData.wholesaleMinQty}
                  onChange={(e) => setFormData({...formData, wholesaleMinQty: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-current-stock" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Current Stock</Label>
                <Input 
                  id="edit-current-stock"
                  name="edit-current-stock"
                  required
                  type="number"
                  step="any"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-black text-xl px-6"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-alert-level" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Alert Level</Label>
                <Input 
                  id="edit-alert-level"
                  name="edit-alert-level"
                  required
                  type="number"
                  className="h-16 rounded-2xl bg-gray-100 border-none font-black text-xl px-6"
                  value={formData.minStock}
                  onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-20 rounded-[28px] bg-primary text-white font-black text-xl shadow-xl mt-4"
              disabled={isSaving}
            >
              {isSaving ? "SAVING..." : "UPDATE PRODUCT"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSpoilageOpen} onOpenChange={setIsSpoilageOpen}>
        <DialogContent className="max-w-md w-full h-[90vh] rounded-t-[44px] border-none p-0 bg-background overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader className="p-8 pb-6 bg-destructive text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <PackageOpen className="h-20 w-20" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Report Spoilage</DialogTitle>
            <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-1 truncate pr-12">{selectedProduct?.name}</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleLogSpoilage} className="p-8 space-y-8 overflow-y-auto flex-1 pb-32">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Spoiled Amount</Label>
                {selectedProduct?.unit === "kg" && (
                  <Tabs value={spoilageData.unit} onValueChange={(val) => setSpoilageData({...spoilageData, unit: val, qty: ""})} className="h-8">
                    <TabsList className="bg-gray-100 rounded-lg p-1 h-full">
                      <TabsTrigger value="base" className="text-[8px] font-black uppercase px-3 h-full data-[state=active]:bg-white data-[state=active]:text-primary">KG</TabsTrigger>
                      <TabsTrigger value="g" className="text-[8px] font-black uppercase px-3 h-full data-[state=active]:bg-white data-[state=active]:text-primary">Grams</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="spoilage-qty" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quantity Lost</Label>
                <div className="relative">
                  <Input 
                    id="spoilage-qty"
                    name="spoilage-qty"
                    required
                    type="number"
                    step="any"
                    className="h-20 rounded-[24px] bg-gray-50 border-transparent font-black text-4xl px-8 text-destructive focus:bg-white transition-all shadow-inner"
                    value={spoilageData.qty}
                    onChange={(e) => setSpoilageData({...spoilageData, qty: e.target.value})}
                    autoFocus
                  />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 font-black text-muted-foreground/30 uppercase text-xs tracking-widest pointer-events-none">
                    {spoilageData.unit === "g" ? "Grams" : selectedProduct?.unit?.toUpperCase() || 'UNIT'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedProduct?.unit === "kg" && spoilageData.unit === "g" ? (
                  [100, 250, 500].map(val => (
                    <Button 
                      key={val}
                      type="button"
                      variant="outline"
                      className="h-12 px-4 rounded-xl font-black text-[10px] uppercase border-gray-100"
                      onClick={() => setSpoilageData({...spoilageData, qty: val.toString()})}
                    >
                      +{val}g
                    </Button>
                  ))
                ) : (
                  [1, 5, 10].map(val => (
                    <Button 
                      key={val}
                      type="button"
                      variant="outline"
                      className="h-12 px-4 rounded-xl font-black text-[10px] uppercase border-gray-100"
                      onClick={() => {
                        const current = Number(spoilageData.qty) || 0
                        setSpoilageData({...spoilageData, qty: (current + val).toString()})
                      }}
                    >
                      +{val}
                    </Button>
                  ))
                )}
                <Button 
                  type="button"
                  variant="outline"
                  className="h-12 px-4 rounded-xl font-black text-[10px] uppercase border-gray-100 text-destructive"
                  onClick={() => setSpoilageData({...spoilageData, qty: (selectedProduct?.stock || 0).toString()})}
                >
                  All
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Loss Reason</Label>
              <div className="flex flex-wrap gap-2">
                {SPOILAGE_REASONS.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                      spoilageData.reason === reason 
                        ? "bg-destructive border-destructive text-white shadow-lg shadow-destructive/20" 
                        : "bg-gray-50 border-transparent text-muted-foreground hover:bg-gray-100"
                    )}
                    onClick={() => setSpoilageData({...spoilageData, reason})}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              {spoilageData.reason === "Other" && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <Label htmlFor="spoilage-notes" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Loss Explanation</Label>
                  <Input 
                    id="spoilage-notes"
                    name="spoilage-notes"
                    placeholder="Describe the loss..."
                    className="h-14 rounded-2xl bg-gray-50 border-none font-bold px-6"
                    onChange={(e) => setSpoilageData({...spoilageData, notes: e.target.value} as any)}
                  />
                </div>
              )}
            </div>

            <div className="p-6 bg-destructive/5 rounded-[32px] border border-destructive/10 space-y-2">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest opacity-60">
                <span>STOCK IMPACT</span>
                <span>FINANCIAL LOSS</span>
              </div>
              <div className="flex justify-between items-end">
                <p className="text-xl font-black text-destructive leading-none">
                  -{Number(spoilageData.qty) || 0} {spoilageData.unit === "g" ? "g" : selectedProduct?.unit?.toUpperCase()}
                </p>
                <p className="text-xl font-black text-destructive leading-none">
                  -{formatCurrency((spoilageData.unit === "g" ? (Number(spoilageData.qty) || 0) / 1000 : (Number(spoilageData.qty) || 0)) * (selectedProduct?.costPrice || 0))}
                </p>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-20 rounded-[32px] bg-destructive text-white font-black text-xl shadow-xl shadow-destructive/20 active:scale-[0.98] transition-all mt-4"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                <div className="flex items-center gap-3">
                  CONFIRM LOSS LOG <ArrowRight className="h-6 w-6" />
                </div>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  )
}
