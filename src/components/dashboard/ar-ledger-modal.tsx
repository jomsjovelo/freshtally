
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
import { CalendarIcon, User, History, CheckCircle2, ChevronRight, UserPlus } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, increment, writeBatch, query, orderBy } from "firebase/firestore"

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
      
      // 1. Log Reconciliation
      const recRef = doc(collection(db, "tenants", tenant.id, "reconciliations"))
      batch.set(recRef, {
        tenantId: tenant.id,
        clientId: selectedClient.id,
        amountPaid: settlementAmount,
        date: date.toISOString(),
        createdAt: new Date()
      })

      // 2. Update Client Balance (Atomic)
      const clientRef = doc(db, "tenants", tenant.id, "b2bClients", selectedClient.id)
      batch.update(clientRef, { outstandingBalance: increment(-settlementAmount) })

      await batch.commit()

      toast({
        title: "Balance Settled",
        description: `Payment of ${formatCurrency(settlementAmount)} logged for ${selectedClient.name}.`,
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md w-full h-[90vh] flex flex-col p-0 border-none bg-background sm:rounded-[40px] overflow-hidden">
        <DialogHeader className="p-8 pb-4 bg-primary text-white">
          <DialogTitle className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
            <History className="h-7 w-7" />
            B2B AR Ledger
          </DialogTitle>
          <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Accounts Receivable Management</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {!selectedClient ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Client Debt List</p>
                <Button variant="ghost" className="h-8 text-[10px] font-black uppercase text-primary">
                  <UserPlus className="h-3 w-3 mr-1" /> Add Client
                </Button>
              </div>
              
              {isLoading ? (
                <div className="py-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest">Scanning Ledgers...</div>
              ) : clients && clients.length > 0 ? (
                clients.map((client) => (
                  <div key={client.id} className="bg-card p-5 rounded-[24px] flex items-center justify-between shadow-sm border border-gray-50 group active:scale-98 transition-all">
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight">{client.name}</p>
                      <p className={cn(
                        "text-xs font-black mt-1 uppercase tracking-widest",
                        client.outstandingBalance > 0 ? "text-destructive" : "text-green-600"
                      )}>
                        {formatCurrency(client.outstandingBalance)} {client.outstandingBalance > 0 ? "Owed" : "Cleared"}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="rounded-xl h-12 px-6 text-[10px] font-black uppercase border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                      onClick={() => setSelectedClient(client)}
                    >
                      Settle
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">No B2B Accounts</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right duration-400">
              <button 
                onClick={() => setSelectedClient(null)}
                className="text-[10px] font-black text-primary flex items-center gap-1 uppercase tracking-widest hover:bg-primary/5 p-2 rounded-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4 rotate-180" /> RETURN TO LEDGER
              </button>

              <div className="bg-primary/5 p-8 rounded-[32px] border-2 border-primary/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <History className="h-20 w-20" />
                </div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Active Obligation</p>
                <h3 className="text-2xl font-black uppercase tracking-tighter">{selectedClient.name}</h3>
                <p className="text-4xl font-black text-primary mt-4 tracking-tighter">
                  {formatCurrency(selectedClient.outstandingBalance)}
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Payment Received</label>
                  <Input 
                    type="number"
                    placeholder="₱ Amount"
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
                  {isProcessing ? "POSTING..." : "CONFIRM RECEIPT"}
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
