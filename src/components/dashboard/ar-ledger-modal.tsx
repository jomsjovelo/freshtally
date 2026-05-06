
"use client"

import { useState } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { 
  CalendarIcon, 
  User, 
  History, 
  CheckCircle2, 
  ChevronRight, 
  UserPlus,
  Share2,
  Copy,
  Receipt
} from "lucide-react"
import { formatCurrency, cn, getAgingCategory, getAgingColor } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, increment, writeBatch, query, orderBy, serverTimestamp } from "firebase/firestore"

/**
 * AR Ledger Engine: Handles settlement and Native Web Share dunning
 */
export function ARLedgerModal({ children }: { children: React.ReactNode }) {
  const { tenant } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState<Date>(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  const clientsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(collection(db, "tenants", tenant.id, "b2bClients"), orderBy("outstandingBalance", "desc"))
  }, [db, tenant?.id])

  const { data: clients, isLoading } = useCollection(clientsQuery)

  const handleSettle = async () => {
    if (!amount || isNaN(Number(amount)) || !tenant?.id || !selectedClient || isProcessing) return
    
    setIsProcessing(true)
    try {
      const settlementAmount = Number(amount)
      const batch = writeBatch(db)
      
      const recRef = doc(collection(db, "tenants", tenant.id, "reconciliations"))
      batch.set(recRef, {
        tenantId: tenant.id,
        clientId: selectedClient.id,
        amountPaid: settlementAmount,
        date: date.toISOString(),
        createdAt: serverTimestamp()
      })

      const clientRef = doc(db, "tenants", tenant.id, "b2bClients", selectedClient.id)
      batch.update(clientRef, { 
        outstandingBalance: increment(-settlementAmount),
        updatedAt: serverTimestamp()
      })

      await batch.commit()

      toast({
        title: "Balance Reconciled",
        description: `Payment of ${formatCurrency(settlementAmount)} applied to ${selectedClient.name}.`,
      })
      setAmount("")
      setSelectedClient(null)
    } catch (error: any) {
      toast({
        title: "Settlement Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Native Share Handler (Manual Dunning): No external SMS cost.
   */
  const handleShareReminder = async (client: any) => {
    const category = getAgingCategory(client.oldestUnpaidAt)
    if (category === 'current' && client.outstandingBalance <= 0) return

    const message = `Hello ${client.name}, this is a friendly reminder from ${tenant?.name} regarding your outstanding balance of ${formatCurrency(client.outstandingBalance)}. Please let us know when we can expect settlement. Thank you!`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Payment Reminder',
          text: message,
        });
      } catch (err) {
        // Fallback to clipboard if share cancelled
        await navigator.clipboard.writeText(message)
        toast({ title: "Reminder Copied", description: "Native share aborted. Message saved to clipboard." })
      }
    } else {
      await navigator.clipboard.writeText(message)
      toast({ title: "Reminder Copied", description: "System doesn't support native share. Message saved to clipboard." })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md w-full h-[90vh] flex flex-col p-0 border-none bg-background sm:rounded-[40px] overflow-hidden">
        <DialogHeader className="p-8 pb-4 bg-primary text-white">
          <DialogTitle className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
            <Receipt className="h-7 w-7" />
            AR Ledger Profile
          </DialogTitle>
          <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Store Charge Monitoring</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {!selectedClient ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Receivables List</p>
                <Button variant="ghost" className="h-8 text-[10px] font-black uppercase text-primary">
                  <UserPlus className="h-3 w-3 mr-1" /> New Account
                </Button>
              </div>
              
              {isLoading ? (
                <div className="py-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Scanning Ledgers...</div>
              ) : clients && clients.length > 0 ? (
                clients.map((client) => {
                  const category = getAgingCategory(client.oldestUnpaidAt)
                  return (
                    <div key={client.id} className="bg-card p-5 rounded-[24px] flex items-center justify-between shadow-sm border border-gray-50 group active:scale-98 transition-all">
                      <div className="flex-1">
                        <p className="font-black text-sm uppercase tracking-tight">{client.name}</p>
                        <p className={cn(
                          "text-xs font-black mt-1 uppercase tracking-widest",
                          getAgingColor(category)
                        )}>
                          {formatCurrency(client.outstandingBalance)} {category !== 'current' ? `(${category.toUpperCase()})` : "Owed"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {client.outstandingBalance > 0 && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-12 w-12 rounded-xl text-primary bg-primary/5"
                            onClick={() => handleShareReminder(client)}
                          >
                            <Share2 className="h-5 w-5" />
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="rounded-xl h-12 px-6 text-[10px] font-black uppercase border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                          onClick={() => setSelectedClient(client)}
                        >
                          Settle
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-20 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">No B2B Accounts Found</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right duration-400">
              <button 
                onClick={() => setSelectedClient(null)}
                className="text-[10px] font-black text-primary flex items-center gap-1 uppercase tracking-widest hover:bg-primary/5 p-2 rounded-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4 rotate-180" /> B2B REGISTRY
              </button>

              <div className="bg-primary/5 p-8 rounded-[32px] border-2 border-primary/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <History className="h-20 w-20" />
                </div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Active Obligation</p>
                <h3 className="text-2xl font-black uppercase tracking-tighter">{selectedClient.name}</h3>
                <p className={cn("text-4xl font-black mt-4 tracking-tighter", getAgingColor(getAgingCategory(selectedClient.oldestUnpaidAt)))}>
                  {formatCurrency(selectedClient.outstandingBalance)}
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Payment Received (₱)</label>
                  <Input 
                    type="number"
                    placeholder="0.00"
                    className="h-16 rounded-[24px] text-xl font-black bg-gray-50 border-none shadow-inner px-6"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Collection Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full h-16 justify-start text-left font-black rounded-[24px] bg-gray-50 border-none shadow-inner px-6",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
                        {date ? format(date, "PPP") : <span>Select Date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-[32px] overflow-hidden border-none shadow-2xl" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Button 
                  className="w-full h-18 rounded-[28px] bg-primary text-white font-black text-xl shadow-xl active:scale-[0.98] transition-all"
                  onClick={handleSettle}
                  disabled={isProcessing}
                >
                  {isProcessing ? "PROCESSING..." : "CONFIRM SETTLEMENT"}
                  <CheckCircle2 className="h-6 w-6 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
