"use client"

import { useState, useMemo, useEffect } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { 
  HandCoins, 
  ChevronLeft, 
  Share2, 
  MapPin, 
  Phone, 
  Calendar as CalendarIcon,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  AlertCircle,
  History as HistoryIcon
} from "lucide-react"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, doc, where, getDoc } from "firebase/firestore"
import { formatCurrency, cn, getAgingCategory, getAgingColor } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { useParams, useRouter } from "next/navigation"

export default function ClientDetailPage() {
  const { tenant } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const clientId = params.clientId as string
  const [client, setClient] = useState<any>(null)
  const [isLoadingClient, setIsLoadingClient] = useState(true)

  useEffect(() => {
    async function fetchClient() {
      if (!db || !tenant?.id || !clientId) return
      try {
        const docRef = doc(db, "tenants", tenant.id, "b2bClients", clientId)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          setClient({ id: docSnap.id, ...docSnap.data() })
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoadingClient(false)
      }
    }
    fetchClient()
  }, [db, tenant?.id, clientId])

  const transactionsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id || !clientId) return null
    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      where("clientId", "==", clientId),
      orderBy("createdAt", "desc")
    )
  }, [db, tenant?.id, clientId])

  const reconciliationsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id || !clientId) return null
    return query(
      collection(db, "tenants", tenant.id, "reconciliations"),
      where("clientId", "==", clientId),
      orderBy("createdAt", "desc")
    )
  }, [db, tenant?.id, clientId])

  const { data: transactions } = useCollection(transactionsQuery)
  const { data: reconciliations } = useCollection(reconciliationsQuery)

  const ledger = useMemo(() => {
    const entries: any[] = []
    
    transactions?.forEach(tx => {
      entries.push({
        id: tx.id,
        date: tx.createdAt?.toDate() || new Date(),
        type: 'credit',
        amount: tx.totalAmount,
        label: tx.type === 'ManualCredit' ? (tx.notes || 'Manual Entry') : 'Store Credit Sale',
        items: tx.items,
        dueDate: tx.dueDate
      })
    })

    reconciliations?.forEach(rec => {
      entries.push({
        id: rec.id,
        date: rec.createdAt?.toDate() || new Date(),
        type: 'payment',
        amount: rec.amountPaid,
        label: rec.notes || 'Payment Received'
      })
    })

    return entries.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [transactions, reconciliations])

  const handleShareStatement = async () => {
    if (!client) return
    const text = `*CREDIT STATEMENT*\n` +
      `*${tenant?.name || 'FreshTally'}*\n\n` +
      `Client: ${client.name}\n` +
      `Current Balance: *${formatCurrency(client.outstandingBalance)}*\n\n` +
      `*Recent Ledger:*\n` +
      ledger.slice(0, 5).map(entry => {
        const dateStr = format(entry.date, "MMM d")
        const prefix = entry.type === 'credit' ? '🔴' : '🟢'
        return `${prefix} ${dateStr}: ${entry.type === 'credit' ? '+' : '-'}${formatCurrency(entry.amount)} (${entry.label})`
      }).join('\n') +
      `\n\n_Please settle your balance soon. Thank you!_`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Credit Statement', text })
      } catch (err) {
        await navigator.clipboard.writeText(text)
        toast({ title: "Statement Copied", description: "Text saved to clipboard." })
      }
    } else {
      await navigator.clipboard.writeText(text)
      toast({ title: "Statement Copied", description: "Text saved to clipboard." })
    }
  }

  if (isLoadingClient || !client) {
    return (
      <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-24 flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        Opening Ledger...
      </div>
    )
  }

  const category = getAgingCategory(client.oldestUnpaidAt)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-32">
      <div className="p-6 space-y-8 flex-1">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white shadow-sm" onClick={() => router.back()}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-foreground uppercase tracking-tight leading-none">{client.name}</h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1.5">{client.type || "Regular"} Account</p>
          </div>
        </header>

        <div className="bg-primary p-8 rounded-[40px] text-white shadow-xl shadow-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <HandCoins className="h-24 w-24" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Total Outstanding</p>
          <h2 className="text-4xl font-black mt-2 tracking-tighter">{formatCurrency(client.outstandingBalance)}</h2>
          <div className="mt-6 flex items-center gap-4">
            <div className={cn("px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/20", 
              category === 'critical' ? 'bg-red-500' : category === 'overdue' ? 'bg-amber-500' : ''
            )}>
              {category.toUpperCase()}
            </div>
            <Button variant="ghost" className="h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase" onClick={handleShareStatement}>
              <Share2 className="h-4 w-4 mr-2" /> Share Slip
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Phone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Contact</p>
              <p className="text-xs font-bold truncate">{client.contact || "None"}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Address</p>
              <p className="text-xs font-bold truncate">{client.address || "No address"}</p>
            </div>
          </div>
        </div>

        {client.notes && (
          <div className="bg-amber-50/50 p-6 rounded-[32px] border border-amber-100 flex gap-4">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="space-y-1">
              <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Internal Notes</p>
              <p className="text-xs font-medium text-amber-900 leading-relaxed">{client.notes}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-2">
            <HistoryIcon className="h-3 w-3" /> Ledger History
          </h3>
          <div className="space-y-3">
            {ledger.map((entry) => (
              <div key={entry.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0", 
                    entry.type === 'credit' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                  )}>
                    {entry.type === 'credit' ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownLeft className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-[13px] uppercase tracking-tight truncate leading-none">{entry.label}</p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-widest">
                      {format(entry.date, "MMM d, yyyy")}
                    </p>
                    {entry.dueDate && entry.type === 'credit' && (
                      <div className="flex items-center gap-1 mt-1 text-[9px] font-black text-amber-600 uppercase">
                        <CalendarIcon className="h-3 w-3" /> Due {format(new Date(entry.dueDate), "MMM d")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-lg font-black tracking-tighter", 
                    entry.type === 'credit' ? 'text-foreground' : 'text-green-600'
                  )}>
                    {entry.type === 'credit' ? '' : '-'}{formatCurrency(entry.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
