
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
  Clock,
  ExternalLink
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
  const { profile, isUserLoading, user } = useUser()
  const db = useFirestore()
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const [expiryDate, setExpiryDate] = useState<Date>(new Date())

  const tenantsQuery = useMemoFirebase(() => {
    // Crucial: ensure user is authenticated and isUserLoading is false before starting the list query
    if (!db || isUserLoading || !user || profile?.role !== 'super_admin') return null
    return collection(db, "tenants")
  }, [db, isUserLoading, user, profile?.role])

  const { data: tenants, isLoading: isQueryLoading } = useCollection(tenantsQuery)

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div className="space-y-4">
          <Clock className="h-16 w-16 text-primary animate-spin mx-auto opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Verifying Authority...</p>
        </div>
      </div>
    )
  }

  if (profile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-destructive/5">
        <AlertCircle className="h-20 w-20 text-destructive mx-auto mb-6" />
        <h1 className="text-3xl font-black uppercase tracking-tighter">Genesis Access Required</h1>
        <p className="text-muted-foreground font-bold text-sm mt-2 max-w-[280px]">
          This terminal is reserved for platform engineers.
        </p>
        <Button className="mt-8 h-16 rounded-[24px] bg-primary w-full max-w-xs font-black uppercase tracking-widest shadow-xl">
          REQUEST ACCESS
        </Button>
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
    <div className="p-4 space-y-6 pb-28">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 bg-primary text-white rounded-[24px] flex items-center justify-center shadow-2xl">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Genesis Hub</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-2">Platform Orchestration</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Card className="border-none shadow-sm bg-blue-50/50 rounded-[32px]">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Store className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-blue-600/70 tracking-widest">Total Shops</p>
              <p className="text-2xl font-black tracking-tighter">{tenants?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-accent/5 rounded-[32px]">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-accent/10 rounded-2xl flex items-center justify-center">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-accent/70 tracking-widest">Sync Status</p>
              <p className="text-xl font-black tracking-tighter uppercase">HEALTHY</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Network Tenants</h2>
        <div className="space-y-3">
          {isQueryLoading ? (
            <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Connecting to Grid...</div>
          ) : tenants?.map((tenant) => (
            <Card key={tenant.id} className="border-none shadow-sm rounded-[32px] overflow-hidden group hover:bg-gray-50 transition-colors">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-black text-lg uppercase tracking-tight truncate">{tenant.name}</h3>
                    <Badge variant={tenant.status === 'active' ? 'secondary' : 'destructive'} className="text-[8px] h-5 uppercase font-black px-2 rounded-lg">
                      {tenant.status}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[9px] text-muted-foreground flex items-center gap-1 font-black uppercase tracking-widest">
                      <Clock className="h-3 w-3" />
                      Expires: {tenant.expiryDate ? format(new Date(tenant.expiryDate), 'MMM dd, yyyy') : 'PERMANENT'}
                    </p>
                    <p className="text-[9px] text-muted-foreground flex items-center gap-1 font-black uppercase tracking-widest opacity-60">
                      {tenant.ownerEmail}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-14 w-14 rounded-2xl border-none bg-gray-100 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          if (tenant.expiryDate) setExpiryDate(new Date(tenant.expiryDate));
                        }}
                      >
                        <Settings2 className="h-6 w-6" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md w-[95%] rounded-[40px] border-none p-0 overflow-hidden bg-background">
                      <DialogHeader className="p-8 bg-primary text-white">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Shop Control</DialogTitle>
                        <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1">{tenant.name} Manager</p>
                      </DialogHeader>
                      <div className="p-8 space-y-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Traffic Control</label>
                          <Button 
                            variant={tenant.status === 'active' ? 'destructive' : 'default'} 
                            className="w-full h-16 rounded-[24px] font-black uppercase tracking-widest shadow-xl text-lg"
                            onClick={() => toggleStatus(tenant)}
                          >
                            {tenant.status === 'active' ? 'SUSPEND SERVICE' : 'RESTORE SERVICE'}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subscription Deadline (V18)</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full h-16 justify-start text-left font-black rounded-[24px] bg-gray-50 border-none shadow-inner px-6",
                                  !expiryDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                {expiryDate ? format(expiryDate, "PPP") : <span>Select Expiry</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-[32px] overflow-hidden" align="center">
                              <Calendar
                                mode="single"
                                selected={expiryDate}
                                onSelect={(d) => d && setExpiryDate(d)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="pt-4 space-y-3">
                          <Button 
                            className="w-full h-18 rounded-[28px] bg-primary text-white font-black text-xl shadow-2xl"
                            onClick={updateExpiry}
                          >
                            COMMIT CHANGES
                          </Button>
                          <Button variant="ghost" className="w-full h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <ExternalLink className="h-4 w-4 mr-2" /> Audit System Logs
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isQueryLoading && (!tenants || tenants.length === 0) && (
            <div className="p-16 text-center text-muted-foreground border-4 border-dashed rounded-[40px] bg-gray-50/50">
              <Store className="h-16 w-16 mx-auto mb-4 opacity-10" />
              <p className="text-xs font-black uppercase tracking-widest">No Active Nodes Found</p>
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  )
}
