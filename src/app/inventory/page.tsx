
"use client"

import { useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Filter, AlertTriangle, MoreVertical, PackageOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn, formatCurrency } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"

export default function InventoryPage() {
  const [search, setSearch] = useState("")
  const { tenant } = useUser()
  const db = useFirestore()

  const inventoryQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "products"),
      orderBy("name", "asc")
    )
  }, [db, tenant?.id])

  const { data: inventory, isLoading } = useCollection(inventoryQuery)

  const filteredInventory = inventory?.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-none text-primary">Inventory</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Live Stock Monitoring</p>
        </div>
        <Button size="icon" className="h-14 w-14 rounded-3xl bg-accent hover:bg-accent/90 shadow-xl active:scale-90 transition-all">
          <Plus className="h-7 w-7" />
        </Button>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search SKUs..." 
            className="pl-12 h-14 bg-gray-100 border-none shadow-sm rounded-2xl font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-14 w-14 p-0 border-none shadow-sm bg-gray-100 rounded-2xl">
          <Filter className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Scanning Warehouse...</div>
        ) : filteredInventory && filteredInventory.length > 0 ? (
          filteredInventory.map((item) => {
            const isLowStock = item.stock < (item.minStock || 10)
            const stockPercent = (item.stock / ((item.minStock || 10) * 2)) * 100
            
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
                      {formatCurrency(item.price)} <span className="opacity-40 ml-1">/ UNIT</span>
                    </p>
                  </div>
                  <button className="text-muted-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className={isLowStock ? "text-destructive" : "text-muted-foreground"}>
                      {item.stock} UNITS IN HAND
                    </span>
                    <span className="text-muted-foreground opacity-60">MIN: {item.minStock || 10}</span>
                  </div>
                  <Progress 
                    value={Math.min(stockPercent, 100)} 
                    className={cn("h-3 rounded-full", isLowStock ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")} 
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest rounded-2xl bg-gray-100 border-none">
                    STOCK ADJUST
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
            <h3 className="text-xl font-black text-muted-foreground uppercase tracking-tighter">Inventory Empty</h3>
            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mt-2 max-w-[200px] mx-auto">
              Your digital shelves are waiting for products.
            </p>
            <Button 
              className="mt-6 h-14 rounded-2xl px-8 bg-primary text-white font-black uppercase tracking-tighter"
            >
              Add First SKU
            </Button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
