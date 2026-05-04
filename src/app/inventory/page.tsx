"use client"

import { useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Filter, AlertTriangle, MoreVertical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const MOCK_INVENTORY = [
  { id: 1, name: "Premium Coffee Beans", stock: 12, min: 20, price: 18.50 },
  { id: 2, name: "Paper Cups (100pk)", stock: 45, min: 30, price: 12.00 },
  { id: 3, name: "Vanilla Syrup", stock: 5, min: 10, price: 8.50 },
  { id: 4, name: "Chocolate Muffin", stock: 15, min: 10, price: 3.25 },
  { id: 5, name: "Almond Milk 1L", stock: 24, min: 12, price: 4.50 },
]

export default function InventoryPage() {
  const [search, setSearch] = useState("")

  return (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage your product stock</p>
        </div>
        <Button size="icon" className="h-12 w-12 rounded-full bg-accent hover:bg-accent/90 shadow-lg active:scale-95 transition-transform">
          <Plus className="h-6 w-6" />
        </Button>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search items..." 
            className="pl-10 h-12 bg-white/50 border-none shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-12 w-12 p-0 border-none shadow-sm bg-white">
          <Filter className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-4">
        {MOCK_INVENTORY.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).map((item) => {
          const isLowStock = item.stock < item.min
          const stockPercent = (item.stock / (item.min * 2)) * 100
          
          return (
            <div key={item.id} className="bg-card p-5 rounded-2xl shadow-sm border-none flex flex-col gap-4 relative overflow-hidden group">
              {isLowStock && (
                <div className="absolute top-0 right-0 p-2">
                  <Badge variant="destructive" className="animate-pulse flex gap-1 items-center px-1.5 py-0.5 text-[10px] uppercase font-black">
                    <AlertTriangle className="h-3 w-3" />
                    Low Stock
                  </Badge>
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-bold text-base text-foreground">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">${item.price.toFixed(2)} per unit</p>
                </div>
                <button className="text-muted-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className={isLowStock ? "text-destructive" : "text-muted-foreground"}>
                    {item.stock} / {item.min} Units
                  </span>
                  <span className="text-muted-foreground">Threshold</span>
                </div>
                <Progress 
                  value={Math.min(stockPercent, 100)} 
                  className={cn("h-2", isLowStock ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")} 
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" className="flex-1 h-10 text-xs font-bold uppercase tracking-widest rounded-xl">
                  Quick Edit
                </Button>
                <Button variant="outline" className="flex-1 h-10 text-xs font-bold uppercase tracking-widest rounded-xl border-2 border-secondary">
                  Restock
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
