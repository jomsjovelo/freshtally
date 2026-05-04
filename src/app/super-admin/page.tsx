
"use client"

import { useState } from "react"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  ShieldCheck, 
  Store, 
  Settings2, 
  Calendar as CalendarIcon, 
  AlertCircle,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"

export default function SuperAdminPage() {
  const { profile } = useUser()
  const db = useFirestore()
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const [expiryDate, setExpiryDate] = useState<Date>(new Date())

  const tenantsQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "tenants")
  }, [db])

  const { data: tenants, isLoading } = useCollection(tenantsQuery)

  if (profile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div className="space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">This area is reserved for Platform Owners.</p>
        </div>
      </div>
    )
  }

  const toggleStatus = (tenant: any) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active'
    updateDoc(doc(db, 'tenants', tenant.id), { status: newStatus })
  }

  const updateExpiry = () => {
    if (!selectedTenant) return
    updateDoc(doc(db, 'tenants', selectedTenant.id), { 
      expiryDate: expiryDate.toISOString(),
      updatedAt: serverTimestamp() 
    })
    setSelectedTenant(null)
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center gap-3">
        <div className="h-12 w-12 bg-accent text-white rounded-2xl flex items-center justify-center shadow-lg">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter">SaaS Manager</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Platform Command</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-none shadow-sm bg-blue-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Store className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-[10px] font-bold uppercase text-blue-600/70">Total Tenants</p>
              <p className="text-lg font-black">{tenants?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-[10px] font-bold uppercase text-orange-600/70">Expiring</p>
              <p className="text-lg font-black">2</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1">Store Network</h2>
        <div className="space-y-2">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Syncing platform state...</div>
          ) : tenants?.map((tenant) => (
            <Card key={tenant.id} className="border-none shadow-sm rounded-2xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm truncate">{tenant.name}</h3>
                    <Badge variant={tenant.status === 'active' ? 'secondary' : 'destructive'} className="text-[9px] h-4 uppercase font-black px-1.5">
                      {tenant.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold uppercase">
                    <Clock className="h-3 w-3" />
                    Expires: {tenant.expiryDate ? format(new Date(tenant.expiryDate), 'MMM dd, yyyy') : 'N/A'}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-10 w-10 rounded-xl border-none bg-secondary/50 text-primary"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          if (tenant.expiryDate) setExpiryDate(new Date(tenant.expiryDate));
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md w-[95%] rounded-3xl border-none">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter">Manage Subscription</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 pt-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Access Control</label>
                          <Button 
                            variant={tenant.status === 'active' ? 'destructive' : 'default'} 
                            className="w-full h-14 rounded-2xl font-bold uppercase tracking-widest"
                            onClick={() => toggleStatus(tenant)}
                          >
                            {tenant.status === 'active' ? 'Suspend Access' : 'Activate Store'}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Set Expiry (Syncros V18)</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full h-14 justify-start text-left font-normal rounded-xl bg-secondary/30 border-none",
                                  !expiryDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {expiryDate ? format(expiryDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl overflow-hidden" align="center">
                              <Calendar
                                mode="single"
                                selected={expiryDate}
                                onSelect={(d) => d && setExpiryDate(d)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <Button 
                          className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl"
                          onClick={updateExpiry}
                        >
                          SAVE CONFIGURATION
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <BottomNav />
    </div>
  )
}
