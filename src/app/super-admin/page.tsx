
"use client"

import { useState } from "react"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  ShieldCheck, 
  Store, 
  Settings2, 
  Calendar as CalendarIcon, 
  AlertCircle,
  Clock,
  ExternalLink,
  Search,
  Megaphone,
  TrendingUp,
  LayoutDashboard,
  Users,
  CheckCircle2,
  XCircle,
  Activity
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
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
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function SuperAdminPage() {
  const { profile, isUserLoading, user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  
  // State for Management
  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const [expiryDate, setExpiryDate] = useState<Date>(new Date())
  const [isProcessing, setIsProcessing] = useState(false)

  // Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState("")
  const [broadcastMessage, setBroadcastMessage] = useState("")
  const [broadcastPriority, setBroadcastPriority] = useState("info")
  const [broadcastExpiry, setBroadcastExpiry] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

  // Data Queries
  const tenantsQuery = useMemoFirebase(() => {
    if (!db || isUserLoading || !user || profile?.role !== 'super_admin') return null
    return query(collection(db, "tenants"), orderBy("createdAt", "desc"))
  }, [db, isUserLoading, user, profile?.role])

  const broadcastsQuery = useMemoFirebase(() => {
    if (!db || profile?.role !== 'super_admin') return null
    return query(collection(db, "platform_broadcasts"), orderBy("createdAt", "desc"), limit(5))
  }, [db, profile?.role])

  const { data: tenants, isLoading: isTenantsLoading } = useCollection(tenantsQuery)
  const { data: broadcasts } = useCollection(broadcastsQuery)

  if (isUserLoading) return <div className="p-20 text-center animate-pulse font-black text-primary uppercase text-xs tracking-widest">Verifying Authority...</div>

  if (profile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-destructive/5">
        <AlertCircle className="h-20 w-20 text-destructive mx-auto mb-6" />
        <h1 className="text-3xl font-black uppercase tracking-tighter">Genesis Access Required</h1>
        <p className="text-muted-foreground font-bold text-sm mt-2 max-w-[280px]">Unauthorized terminal entry.</p>
        <Button className="mt-8 h-16 rounded-[24px] bg-primary w-full max-w-xs font-black uppercase tracking-widest shadow-xl">REQUEST ACCESS</Button>
      </div>
    )
  }

  const filteredTenants = tenants?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) return
    setIsProcessing(true)
    try {
      await addDoc(collection(db, "platform_broadcasts"), {
        title: broadcastTitle,
        message: broadcastMessage,
        priority: broadcastPriority,
        activeUntil: broadcastExpiry.toISOString(),
        createdAt: serverTimestamp()
      })
      toast({ title: "Broadcast Sent", description: "Global announcement is now live." })
      setBroadcastTitle("")
      setBroadcastMessage("")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTenantAction = async (action: 'status' | 'verify' | 'expiry') => {
    if (!selectedTenant) return
    setIsProcessing(true)
    try {
      const tenantRef = doc(db, "tenants", selectedTenant.id)
      if (action === 'status') {
        await updateDoc(tenantRef, { status: selectedTenant.status === 'active' ? 'suspended' : 'active' })
      } else if (action === 'verify') {
        await updateDoc(tenantRef, { isVerified: !selectedTenant.isVerified })
      } else if (action === 'expiry') {
        await updateDoc(tenantRef, { expiryDate: expiryDate.toISOString() })
      }
      toast({ title: "Update Successful", description: `${selectedTenant.name} has been updated.` })
      setSelectedTenant(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // Calculate MRR (Simplified for demo: sum of prices of active tiers)
  const mrr = tenants?.reduce((acc, t) => {
    if (t.status !== 'active') return acc
    const planPrices = { basic: 999, pro: 2499, enterprise: 4999 }
    return acc + (planPrices[t.subscriptionPlan as keyof typeof planPrices] || 0)
  }, 0) || 0

  return (
    <div className="p-4 space-y-6 pb-28">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 bg-primary text-white rounded-[24px] flex items-center justify-center shadow-2xl">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Command Center</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-2">Platform Orchestration V2</p>
        </div>
      </header>

      <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 h-14 bg-gray-100 rounded-2xl p-1">
          <TabsTrigger value="overview" className="rounded-xl font-black text-[10px] uppercase"><LayoutDashboard className="w-4 h-4 mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="registry" className="rounded-xl font-black text-[10px] uppercase"><Users className="w-4 h-4 mr-2" /> Registry</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-xl font-black text-[10px] uppercase"><Megaphone className="w-4 h-4 mr-2" /> Broadcast</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-none shadow-sm bg-blue-50/50 rounded-[32px]">
              <CardContent className="p-5">
                <p className="text-[9px] font-black uppercase text-blue-600/70 tracking-widest mb-1">Platform MRR</p>
                <p className="text-2xl font-black tracking-tighter">{formatCurrency(mrr)}</p>
                <div className="flex items-center gap-1 text-[8px] font-black text-green-600 mt-2">
                  <TrendingUp className="w-3 h-3" /> +14.2% THIS MONTH
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-accent/5 rounded-[32px]">
              <CardContent className="p-5">
                <p className="text-[9px] font-black uppercase text-accent/70 tracking-widest mb-1">Active Nodes</p>
                <p className="text-2xl font-black tracking-tighter">{tenants?.filter(t => t.status === 'active').length || 0}</p>
                <div className="flex items-center gap-1 text-[8px] font-black text-accent mt-2 uppercase tracking-widest">
                  <Activity className="w-3 h-3" /> System Healthy
                </div>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Recent Activity</h3>
            <div className="space-y-2">
              {tenants?.slice(0, 3).map(t => (
                <div key={t.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center font-black text-primary text-xs">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight">{t.name}</p>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase">New Registration</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[8px] uppercase font-black">{t.subscriptionPlan}</Badge>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="registry" className="space-y-6 pt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search tenants or emails..." 
              className="pl-12 h-14 bg-gray-100 border-none shadow-sm rounded-2xl font-bold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {isTenantsLoading ? (
              <div className="p-20 text-center animate-pulse font-black text-muted-foreground text-xs uppercase tracking-widest">Scanning Grid...</div>
            ) : filteredTenants?.map((tenant) => (
              <Card key={tenant.id} className="border-none shadow-sm rounded-[28px] overflow-hidden group hover:bg-gray-50 transition-colors">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-base uppercase tracking-tight truncate">{tenant.name}</h3>
                      {tenant.isVerified && <CheckCircle2 className="h-3 w-3 text-blue-500 fill-blue-500/10" />}
                    </div>
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {format(new Date(tenant.expiryDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-12 w-12 rounded-xl bg-gray-50 text-primary hover:bg-primary hover:text-white transition-all"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setExpiryDate(new Date(tenant.expiryDate));
                        }}
                      >
                        <Settings2 className="h-6 w-6" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md w-[95%] rounded-[40px] border-none p-0 overflow-hidden">
                      <DialogHeader className="p-8 bg-primary text-white">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Tenant Intelligence</DialogTitle>
                        <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1">Management Profile: {tenant.name}</p>
                      </DialogHeader>
                      <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant={tenant.status === 'active' ? 'destructive' : 'default'} 
                            className="h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                            onClick={() => handleTenantAction('status')}
                            disabled={isProcessing}
                          >
                            {tenant.status === 'active' ? <XCircle className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            {tenant.status === 'active' ? 'SUSPEND' : 'ACTIVATE'}
                          </Button>
                          <Button 
                            variant="outline"
                            className="h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2"
                            onClick={() => handleTenantAction('verify')}
                            disabled={isProcessing}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {tenant.isVerified ? 'UNVERIFY' : 'VERIFY'}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subscription Deadline</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full h-16 justify-start text-left font-black rounded-2xl bg-gray-50 border-none px-6",
                                  !expiryDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                {expiryDate ? format(expiryDate, "PPP") : <span>Set Deadline</span>}
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

                        <Button 
                          className="w-full h-18 rounded-[28px] bg-primary text-white font-black text-lg shadow-xl"
                          onClick={() => handleTenantAction('expiry')}
                          disabled={isProcessing}
                        >
                          {isProcessing ? "SYNCING..." : "COMMIT CHANGES"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-6 pt-4">
          <Card className="border-none shadow-sm bg-white rounded-[32px] p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Message Priority</label>
                <Select value={broadcastPriority} onValueChange={setBroadcastPriority}>
                  <SelectTrigger className="h-14 rounded-xl border-none bg-gray-50 font-black uppercase text-[10px] px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="info" className="font-bold">INFO (BLUE)</SelectItem>
                    <SelectItem value="warning" className="font-bold">WARNING (ORANGE)</SelectItem>
                    <SelectItem value="critical" className="font-bold">CRITICAL (RED)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Broadcast Title</label>
                <Input 
                  placeholder="e.g. Scheduled Maintenance" 
                  className="h-14 rounded-xl bg-gray-50 border-none font-bold"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Detailed Announcement</label>
                <Textarea 
                  placeholder="Enter message for all tenant owners..." 
                  className="rounded-2xl bg-gray-50 border-none font-bold min-h-[120px]"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Expiry Date (Syncros V18)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-14 justify-start text-left font-black rounded-xl bg-gray-50 border-none px-4">
                      <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                      {format(broadcastExpiry, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-[32px] overflow-hidden">
                    <Calendar
                      mode="single"
                      selected={broadcastExpiry}
                      onSelect={(d) => d && setBroadcastExpiry(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button 
                className="w-full h-16 rounded-[24px] bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
                onClick={handleCreateBroadcast}
                disabled={isProcessing}
              >
                {isProcessing ? "DISPATCHING..." : "DISPATCH BROADCAST"}
                <Megaphone className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </Card>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Recent Dispatches</h3>
            <div className="space-y-2">
              {broadcasts?.map(b => (
                <div key={b.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-black uppercase tracking-tight">{b.title}</p>
                    <Badge variant={b.priority === 'critical' ? 'destructive' : b.priority === 'warning' ? 'secondary' : 'default'} className="text-[7px] uppercase h-4">
                      {b.priority}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{b.message}</p>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <BottomNav />
    </div>
  )
}
