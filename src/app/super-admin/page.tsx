
"use client"

import { useState, useMemo } from "react"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Calendar as CalendarIcon, 
  AlertCircle,
  Clock,
  Search,
  Megaphone,
  Users,
  CheckCircle2,
  CreditCard,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addDays } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { BottomNav } from "@/components/layout/bottom-nav"

export default function SuperAdminPage() {
  const { profile, isUserLoading, user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const [expiryDate, setExpiryDate] = useState<Date>(new Date())
  const [selectedPlan, setSelectedPlan] = useState<string>("basic")
  const [isProcessing, setIsProcessing] = useState(false)

  const [broadcastTitle, setBroadcastTitle] = useState("")
  const [broadcastMessage, setBroadcastMessage] = useState("")
  const [broadcastPriority, setBroadcastPriority] = useState("info")
  const [broadcastExpiry, setBroadcastExpiry] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || isUserLoading || !user || profile?.role !== 'super_admin') return null
    return query(collection(db, "tenants"), orderBy("createdAt", "desc"), limit(50))
  }, [db, isUserLoading, user, profile?.role])

  const broadcastsQuery = useMemoFirebase(() => {
    if (!db || profile?.role !== 'super_admin') return null
    return query(collection(db, "platform_broadcasts"), orderBy("createdAt", "desc"), limit(10))
  }, [db, profile?.role])

  const { data: tenants, isLoading: isTenantsLoading } = useCollection(tenantsQuery)
  const { data: broadcasts } = useCollection(broadcastsQuery)

  const filteredTenants = useMemo(() => {
    if (!tenants) return []
    return tenants.filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [tenants, searchQuery])

  if (isUserLoading) return <div className="p-20 text-center animate-pulse font-black text-primary uppercase text-xs tracking-widest">Verifying...</div>

  if (profile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-destructive/5">
        <AlertCircle className="h-20 w-20 text-destructive mx-auto mb-6" />
        <h1 className="text-3xl font-black uppercase tracking-tighter">Access Denied</h1>
        <Button className="mt-8 h-16 rounded-[24px] bg-primary w-full max-w-xs font-black uppercase shadow-xl">REQUEST ACCESS</Button>
      </div>
    )
  }

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
      toast({ title: "Broadcast Live" })
      setBroadcastTitle("")
      setBroadcastMessage("")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTenantAction = async (action: 'status' | 'verify' | 'expiry' | 'plan') => {
    if (!selectedTenant) return
    setIsProcessing(true)
    try {
      const tenantRef = doc(db, "tenants", selectedTenant.id)
      let updateData: any = {}

      if (action === 'status') {
        updateData = { status: selectedTenant.status === 'active' ? 'suspended' : 'active' }
      } else if (action === 'verify') {
        updateData = { isVerified: !selectedTenant.isVerified }
      } else if (action === 'expiry') {
        updateData = { expiryDate: expiryDate.toISOString() }
      } else if (action === 'plan') {
        updateData = { 
          subscriptionPlan: selectedPlan,
          status: selectedTenant.status,
          expiryDate: expiryDate.toISOString()
        }
      }

      await updateDoc(tenantRef, updateData)
      toast({ title: "Synchronized" })
      if (action === 'plan') setSelectedTenant(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStartTrial = () => {
    setExpiryDate(addDays(new Date(), 60))
    toast({ title: "Trial Set (60 Days)" })
  }

  return (
    <div className="p-4 space-y-6 pb-28">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 bg-primary text-white rounded-[24px] flex items-center justify-center shadow-2xl">
          <Users className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Registry</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-2">Node management</p>
        </div>
      </header>

      <Tabs defaultValue="registry" className="w-full">
        <TabsList className="grid grid-cols-2 h-14 bg-gray-100 rounded-2xl p-1">
          <TabsTrigger value="registry" className="rounded-xl font-black text-[10px] uppercase">Registry</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-xl font-black text-[10px] uppercase">Broadcast</TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="space-y-6 pt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search nodes..." 
              className="pl-12 h-14 bg-gray-100 border-none shadow-sm rounded-2xl font-bold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {isTenantsLoading ? (
              <div className="p-20 text-center animate-pulse font-black text-muted-foreground text-xs uppercase tracking-widest">Scanning...</div>
            ) : filteredTenants.map((tenant) => (
              <Card key={tenant.id} className="border-none shadow-sm rounded-[28px] overflow-hidden">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-base uppercase tracking-tight truncate">{tenant.name}</h3>
                      {tenant.isVerified && <CheckCircle2 className="h-3 w-3 text-blue-500" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {format(new Date(tenant.expiryDate), 'MMM dd, yyyy')}
                      </p>
                      <Badge variant={tenant.status === 'active' ? 'default' : 'destructive'} className="text-[7px] uppercase h-4">
                        {tenant.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-12 w-12 rounded-xl bg-gray-50 text-primary"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setExpiryDate(new Date(tenant.expiryDate));
                          setSelectedPlan(tenant.subscriptionPlan || 'basic');
                        }}
                      >
                        <CreditCard className="h-6 w-6" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[90vh] rounded-t-[40px] border-none p-0 overflow-hidden bg-background">
                      <SheetHeader className="p-8 bg-primary text-white text-left">
                        <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-white">Management</SheetTitle>
                      </SheetHeader>
                      
                      <div className="p-8 space-y-8 overflow-y-auto h-full pb-32">
                        <div className="flex items-center justify-between bg-gray-50 p-6 rounded-3xl">
                          <Label className="text-sm font-black uppercase">Status</Label>
                          <Switch 
                            checked={tenant.status === 'active'} 
                            onCheckedChange={() => handleTenantAction('status')}
                          />
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {['free', 'basic', 'pro', 'enterprise'].map((plan) => (
                              <button
                                key={plan}
                                onClick={() => setSelectedPlan(plan)}
                                className={cn(
                                  "h-14 rounded-2xl border-2 transition-all font-black uppercase text-[10px]",
                                  selectedPlan === plan ? "border-primary bg-primary/5" : "border-gray-100"
                                )}
                              >
                                {plan}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <Button variant="link" onClick={handleStartTrial} className="p-0 h-auto text-[10px] font-black uppercase text-accent">
                            <Zap className="h-3 w-3 mr-1" /> Automated 60-Day Trial
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full h-16 font-black rounded-2xl bg-gray-50 border-none px-6">
                                <CalendarIcon className="mr-3 h-6 w-6 text-primary" />
                                {expiryDate ? format(expiryDate, "PPP") : "Set Expiry"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-[32px] overflow-hidden">
                              <Calendar mode="single" selected={expiryDate} onSelect={(d) => d && setExpiryDate(d)} />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <Button 
                          className="w-full h-20 rounded-[28px] bg-primary text-white font-black text-xl"
                          onClick={() => handleTenantAction('plan')}
                          disabled={isProcessing}
                        >
                          SAVE OVERRIDE
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-6 pt-4">
          <Card className="border-none shadow-sm bg-white rounded-[32px] p-6 space-y-6">
            <div className="space-y-4">
              <Select value={broadcastPriority} onValueChange={setBroadcastPriority}>
                <SelectTrigger className="h-14 rounded-xl border-none bg-gray-50 font-black uppercase text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none">
                  <SelectItem value="info" className="font-bold uppercase">Info</SelectItem>
                  <SelectItem value="warning" className="font-bold uppercase">Warning</SelectItem>
                  <SelectItem value="critical" className="font-bold uppercase">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Input 
                placeholder="Broadcast Title" 
                className="h-14 rounded-xl bg-gray-50 border-none font-bold"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
              />

              <Textarea 
                placeholder="Message details..." 
                className="rounded-2xl bg-gray-50 border-none font-bold min-h-[120px]"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
              />

              <Button 
                className="w-full h-16 rounded-[24px] bg-primary text-white font-black text-lg"
                onClick={handleCreateBroadcast}
                disabled={isProcessing}
              >
                DISPATCH BROADCAST
                <Megaphone className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </Card>

          <div className="space-y-2">
            {broadcasts?.map(b => (
              <div key={b.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-black uppercase">{b.title}</p>
                  <Badge variant={b.priority === 'critical' ? 'destructive' : 'default'} className="text-[7px] uppercase h-4">
                    {b.priority}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <BottomNav />
    </div>
  )
}
