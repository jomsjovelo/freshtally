"use client"

import { useState, useMemo } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  HandCoins, 
  UserPlus, 
  Search, 
  History as HistoryIcon, 
  Share2, 
  ChevronRight,
  Plus,
  ArrowRight,
  Receipt,
  CheckCircle2,
  CalendarIcon,
  Loader2
} from "lucide-react"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, doc, increment, writeBatch, serverTimestamp, addDoc, getDocs, where, Timestamp } from "firebase/firestore"
import { formatCurrency, cn, getAgingCategory, getAgingColor } from "@/lib/utils"
import { ClientSchema, TransactionSchema } from "@/lib/schemas"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"

export default function AccountsPage() {
  const { tenant, profile, isUserLoading } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Manual Credit Form State
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [creditAmount, setCreditAmount] = useState("")
  const [creditNotes, setCreditNotes] = useState("")
  const [creditDate, setCreditDate] = useState<Date>(new Date())
  const [creditDueDate, setCreditDueDate] = useState<Date | undefined>(undefined)

  // Payment Form State
  const [paymentClientId, setPaymentClientId] = useState("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentDate, setPaymentDate] = useState<Date>(new Date())
  
  // Client Registration State
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [newClientData, setNewClientData] = useState({
    name: "",
    type: "Regular",
    phone: "",
    email: "",
    address: ""
  })

  const clientsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(collection(db, "tenants", tenant.id, "b2bClients"), orderBy("name", "asc"))
  }, [db, tenant?.id])

  const { data: clients, isLoading: isClientsLoading } = useCollection(clientsQuery)

  const filteredClients = useMemo(() => {
    if (!clients) return []
    return clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  }, [clients, search])

  const handleAddManualCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tenant?.id || !selectedClientId || !creditAmount || isProcessing) return

    setIsProcessing(true)
    try {
      const client = clients?.find(c => c.id === selectedClientId)
      
      const validation = TransactionSchema.safeParse({
        tenantId: tenant.id,
        clientId: selectedClientId,
        clientName: client?.name,
        totalAmount: Number(creditAmount),
        type: "ManualCredit",
        items: [],
        notes: creditNotes,
        dueDate: creditDueDate ? creditDueDate.toISOString() : null,
      })

      if (!validation.success) {
        toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" })
        setIsProcessing(false)
        return
      }

      const amount = validation.data.totalAmount
      const batch = writeBatch(db)
      
      const txColRef = collection(db, "tenants", tenant.id, "transactions")
      const txDocRef = doc(txColRef)
      
      batch.set(txDocRef, {
        ...validation.data,
        createdAt: Timestamp.fromDate(creditDate),
        updatedAt: serverTimestamp()
      })

      const clientRef = doc(db, "tenants", tenant.id, "b2bClients", selectedClientId)
      batch.update(clientRef, { 
        outstandingBalance: increment(amount),
        updatedAt: serverTimestamp(),
        // Only set oldestUnpaidAt if it doesn't already exist
        ...(!client?.oldestUnpaidAt && { oldestUnpaidAt: serverTimestamp() })
      })

      await batch.commit()
      toast({ title: "Credit Recorded", description: `Added ${formatCurrency(amount)} to ${client?.name}'s account.` })
      setCreditAmount("")
      setCreditNotes("")
      setCreditDueDate(undefined)
      setSelectedClientId(null)
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tenant?.id || !paymentClientId || !paymentAmount || isProcessing) return

    setIsProcessing(true)
    try {
      const client = clients?.find(c => c.id === paymentClientId)
      const amount = Number(paymentAmount)
      const batch = writeBatch(db)

      const recRef = doc(collection(db, "tenants", tenant.id, "reconciliations"))
      batch.set(recRef, {
        tenantId: tenant.id,
        clientId: paymentClientId,
        amountPaid: amount,
        notes: paymentNotes,
        date: paymentDate.toISOString(),
        createdAt: serverTimestamp()
      })

      const clientRef = doc(db, "tenants", tenant.id, "b2bClients", paymentClientId)
      const newBalance = (client?.outstandingBalance || 0) - amount
      
      batch.update(clientRef, {
        outstandingBalance: increment(-amount),
        updatedAt: serverTimestamp(),
        // Clear aging flag if balance is settled
        ...(newBalance <= 0 && { oldestUnpaidAt: null })
      })

      await batch.commit()
      toast({ title: "Payment Recorded", description: `Settled ${formatCurrency(amount)} for ${client?.name}.` })
      setPaymentAmount("")
      setPaymentNotes("")
      setPaymentClientId("")
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tenant?.id || isProcessing) return

    setIsProcessing(true)
    const validation = ClientSchema.safeParse({
      ...newClientData,
      tenantId: tenant.id
    })

    if (!validation.success) {
      toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" })
      setIsProcessing(false)
      return
    }

    try {
      await addDoc(collection(db, "tenants", tenant.id, "b2bClients"), {
        ...validation.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Client Registered", description: `${newClientData.name} added to registry.` })
      setIsAddClientOpen(false)
      setNewClientData({ name: "", type: "Regular", phone: "", email: "", address: "" })
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  if (isUserLoading) {
    return (
      <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-24 flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        Loading Accounts...
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-32">
      <div className="p-6 space-y-6 flex-1">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Accounts</h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Manage Regular Clients & Credit</p>
          </div>
          
          <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="h-14 w-14 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                <UserPlus className="h-7 w-7" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md w-full h-[90vh] rounded-t-[44px] border-none p-0 bg-background overflow-hidden flex flex-col shadow-2xl">
              <DialogHeader className="p-8 pb-4 bg-primary text-white">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">New Client</DialogTitle>
                <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-1">Register B2B Account</DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSaveClient} className="p-8 space-y-6 overflow-y-auto flex-1 pb-32">
                <div className="space-y-2">
                  <Label htmlFor="client-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Client / Business Name</Label>
                  <Input 
                    id="client-name"
                    name="client-name"
                    required
                    placeholder="e.g. Sari-Sari Store #1"
                    className="h-16 rounded-2xl bg-gray-100 border-none font-bold text-lg px-6"
                    value={newClientData.name}
                    onChange={(e) => setNewClientData({...newClientData, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-type-trigger" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Type</Label>
                  <Select value={newClientData.type} onValueChange={(val) => setNewClientData({...newClientData, type: val})}>
                    <SelectTrigger id="client-type-trigger" name="client-type-trigger" className="h-16 rounded-2xl bg-gray-100 border-none font-bold px-6">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      <SelectItem value="Regular" className="font-bold">Regular</SelectItem>
                      <SelectItem value="Wholesale" className="font-bold">Wholesale</SelectItem>
                      <SelectItem value="Staff" className="font-bold">Staff</SelectItem>
                      <SelectItem value="Other" className="font-bold">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-phone" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                  <Input 
                    id="client-phone"
                    name="client-phone"
                    placeholder="e.g. 0912 345 6789"
                    className="h-16 rounded-2xl bg-gray-100 border-none font-bold px-6"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-address" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Delivery Address</Label>
                  <Input 
                    id="client-address"
                    name="client-address"
                    placeholder="Street, Barangay, City"
                    className="h-16 rounded-2xl bg-gray-100 border-none font-bold px-6"
                    value={newClientData.address}
                    onChange={(e) => setNewClientData({...newClientData, address: e.target.value})}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-20 rounded-[28px] bg-primary text-white font-black text-xl shadow-xl mt-4"
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "REGISTER CLIENT"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <Tabs defaultValue="clients" className="space-y-6">
          <TabsList className="w-full h-14 bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
            <TabsTrigger value="clients" className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Clients</TabsTrigger>
            <TabsTrigger value="add" className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">+ Credit</TabsTrigger>
            <TabsTrigger value="pay" className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Collect</TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search clients..." 
                className="pl-12 h-14 bg-white border-none shadow-sm rounded-2xl font-bold"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {isClientsLoading ? (
                <div className="py-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Scanning Registry...</div>
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => {
                  const category = getAgingCategory(client.oldestUnpaidAt)
                  return (
                    <button 
                      key={client.id}
                      onClick={() => router.push(`/accounts/${client.id}`)}
                      className="w-full bg-white p-6 rounded-[32px] flex items-center justify-between shadow-sm border border-transparent active:scale-[0.98] transition-all text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm uppercase tracking-tight">{client.name}</p>
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-muted-foreground uppercase">{client.type || "Other"}</span>
                        </div>
                        <p className={cn("text-lg font-black mt-1 tracking-tighter", getAgingColor(category))}>
                          {formatCurrency(client.outstandingBalance)}
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 text-muted-foreground/30" />
                    </button>
                  )
                })
              ) : (
                <div className="py-20 text-center bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                  <HandCoins className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">No credit accounts found</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="add" className="animate-in fade-in slide-in-from-bottom-4">
            <form onSubmit={handleAddManualCredit} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="credit-client-trigger" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Customer</Label>
                  <Select onValueChange={setSelectedClientId}>
                    <SelectTrigger id="credit-client-trigger" name="credit-client-trigger" className="h-16 rounded-2xl border-none bg-gray-50 font-black uppercase text-xs tracking-widest px-6">
                      <SelectValue placeholder="CHOOSE CLIENT" />
                    </SelectTrigger>
                    <SelectContent className="rounded-3xl border-none shadow-2xl">
                      {clients?.map(client => (
                        <SelectItem key={client.id} value={client.id} className="font-bold py-3">{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credit-amount" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Credit Amount (₱)</Label>
                  <Input 
                    id="credit-amount"
                    name="credit-amount"
                    placeholder="0.00" 
                    type="number"
                    className="h-16 rounded-2xl bg-gray-50 border-none px-6 font-black text-xl"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credit-notes" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description / Notes</Label>
                  <Input 
                    id="credit-notes"
                    name="credit-notes"
                    placeholder="e.g. 5 sacks of rice" 
                    className="h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold"
                    value={creditNotes}
                    onChange={(e) => setCreditNotes(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="credit-date-btn" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Entry Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button id="credit-date-btn" name="credit-date-btn" variant="outline" className="w-full h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(creditDate, "MMM d, yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl">
                        <Calendar mode="single" selected={creditDate} onSelect={(d) => d && setCreditDate(d)} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="credit-due-date-btn" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button id="credit-due-date-btn" name="credit-due-date-btn" variant="outline" className="w-full h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {creditDueDate ? format(creditDueDate, "MMM d, yyyy") : "Optional"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl">
                        <Calendar mode="single" selected={creditDueDate} onSelect={setCreditDueDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full h-20 rounded-[28px] bg-primary text-white font-black text-xl shadow-xl active:scale-[0.98] transition-all"
                disabled={isProcessing || !selectedClientId || !creditAmount}
              >
                {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "RECORD CREDIT ENTRY"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="pay" className="animate-in fade-in slide-in-from-bottom-4">
            <form onSubmit={handleRecordPayment} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="payment-client-trigger" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Payment From</Label>
                <Select value={paymentClientId} onValueChange={setPaymentClientId}>
                  <SelectTrigger id="payment-client-trigger" name="payment-client-trigger" className="h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold uppercase text-[10px] tracking-widest">
                    <SelectValue placeholder="WHICH CLIENT?" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    {clients?.filter(c => c.outstandingBalance > 0).map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-bold">{c.name} ({formatCurrency(c.outstandingBalance)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-amount" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount Received (₱)</Label>
                <Input 
                  id="payment-amount"
                  name="payment-amount"
                  type="number" 
                  placeholder="0.00" 
                  required
                  className="h-16 rounded-2xl bg-gray-50 border-none px-6 font-black text-2xl tracking-tighter text-green-600"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-date-btn" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Collection Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="payment-date-btn" name="payment-date-btn" variant="outline" className="w-full h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold text-left justify-start">
                      <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
                      {format(paymentDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl">
                    <Calendar mode="single" selected={paymentDate} onSelect={(d) => d && setPaymentDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Reference / Note</Label>
                <Input 
                  id="payment-notes"
                  name="payment-notes"
                  placeholder="e.g. GCash, Partial Payment" 
                  className="h-16 rounded-2xl bg-gray-50 border-none px-6 font-bold"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-20 rounded-[32px] bg-green-600 text-white font-black text-xl shadow-xl active:scale-95 transition-all mt-4"
                disabled={isProcessing || !paymentClientId || !paymentAmount}
              >
                {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "CONFIRM COLLECTION"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  )
}
