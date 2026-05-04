
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
import { CalendarIcon, User, History, CheckCircle2, ChevronRight } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const MOCK_B2B_CLIENTS = [
  { id: "c1", name: "Starbucks Corp", outstandingBalance: 12500.00 },
  { id: "c2", name: "Ayala Mall Operations", outstandingBalance: 4520.50 },
  { id: "c3", name: "BGC Security Services", outstandingBalance: 8900.00 },
]

export function ARLedgerModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState<Date>(new Date())
  const { toast } = useToast()

  const handleSettle = () => {
    if (!amount || isNaN(Number(amount))) return
    
    toast({
      title: "Balance Settled",
      description: `Payment of ${formatCurrency(Number(amount))} logged for ${selectedClient.name}.`,
    })
    setAmount("")
    setSelectedClient(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md w-full h-[90vh] flex flex-col p-0 border-none bg-background sm:rounded-3xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Accounts Receivable
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          {!selectedClient ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Accounts</p>
              {MOCK_B2B_CLIENTS.map((client) => (
                <div key={client.id} className="bg-card p-4 rounded-2xl flex items-center justify-between shadow-sm border border-border/50">
                  <div>
                    <p className="font-bold text-sm">{client.name}</p>
                    <p className="text-xs text-destructive font-semibold mt-1">
                      {formatCurrency(client.outstandingBalance)} Owed
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-xl h-10 px-4 text-xs font-bold border-primary text-primary hover:bg-primary hover:text-white"
                    onClick={() => setSelectedClient(client)}
                  >
                    Settle
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <button 
                onClick={() => setSelectedClient(null)}
                className="text-xs font-bold text-primary flex items-center gap-1 uppercase tracking-tighter"
              >
                <ChevronRight className="h-4 w-4 rotate-180" /> Back to List
              </button>

              <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Settling for</p>
                <h3 className="text-lg font-black">{selectedClient.name}</h3>
                <p className="text-2xl font-black text-primary mt-2">
                  {formatCurrency(selectedClient.outstandingBalance)}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest pl-1">Payment Amount</label>
                  <Input 
                    type="number"
                    placeholder="Enter amount (₱)"
                    className="h-14 rounded-xl text-lg font-bold bg-white/50 border-none shadow-inner"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest pl-1">Payment Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full h-14 justify-start text-left font-normal rounded-xl bg-white/50 border-none shadow-inner",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden border-none shadow-2xl" align="start">
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
                  className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-all"
                  onClick={handleSettle}
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  LOG PAYMENT
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
