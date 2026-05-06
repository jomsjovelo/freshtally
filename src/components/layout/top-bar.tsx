'use client';

import { useState, useEffect, useMemo } from "react"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Store, Loader2, ShieldCheck, Bell } from "lucide-react"
import { usePathname } from "next/navigation"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { collection, query, where } from "firebase/firestore"
import { getAgingCategory, cn, formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/**
 * Structural Guard: Render the outer shell unconditionally to prevent hydration mismatches.
 */
export function TopBar() {
  const { tenant, isUserLoading, profile, user } = useUser()
  const db = useFirestore()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const overdueClientsQuery = useMemoFirebase(() => {
    if (!mounted || !db || !tenant?.id || !profile?.tenantId) return null
    // Security: Only fire query if identity is verified
    if (tenant.id !== profile.tenantId) return null
    
    return query(
      collection(db, "tenants", tenant.id, "b2bClients"),
      where("outstandingBalance", ">", 0)
    )
  }, [mounted, db, tenant?.id, profile?.tenantId])

  const { data: b2bClients } = useCollection(overdueClientsQuery)

  const alerts = useMemo(() => {
    if (!b2bClients) return []
    return b2bClients
      .map(client => ({
        ...client,
        category: getAgingCategory(client.oldestUnpaidAt)
      }))
      .filter(c => c.category !== 'current')
  }, [b2bClients])

  const isSuperAdmin = profile?.role === 'super_admin'

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 h-16 px-4 flex items-center justify-between">
      {mounted && pathname !== '/auth' && user && (
        <>
          <div className="flex items-center gap-3 overflow-hidden">
            {isUserLoading ? (
              <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
              </div>
            ) : (
              <>
                <Avatar className="h-9 w-9 rounded-xl border border-gray-200 shadow-sm">
                  <AvatarImage src={isSuperAdmin ? undefined : tenant?.logoUrl} alt={tenant?.name || 'User'} />
                  <AvatarFallback className={isSuperAdmin ? "bg-accent text-white" : "bg-primary/5 text-primary"}>
                    {isSuperAdmin ? <ShieldCheck className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-tighter truncate leading-none text-foreground">
                    {isSuperAdmin ? 'CENTRAL' : (tenant?.name || 'TERMINAL')}
                  </h2>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1 truncate">
                    {isSuperAdmin ? 'ADMIN' : (profile?.role || 'STATION')}
                  </p>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative h-10 w-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <Bell className={cn("h-5 w-5", alerts.length > 0 ? "text-destructive animate-pulse" : "text-muted-foreground")} />
                  {alerts.length > 0 && (
                    <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-destructive rounded-full border-2 border-white" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 rounded-[24px] border-none shadow-2xl p-2 mt-2">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground p-3">
                  Alert Center
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {alerts.length > 0 ? (
                  alerts.map(alert => (
                    <DropdownMenuItem key={alert.id} className="p-3 rounded-xl focus:bg-gray-50 cursor-pointer flex flex-col items-start gap-1">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-black text-[11px] uppercase truncate">{alert.name}</span>
                        <Badge variant={alert.category === 'critical' ? 'destructive' : 'default'} className="text-[7px] uppercase px-1.5 h-4 font-black">
                          {alert.category}
                        </Badge>
                      </div>
                      <p className="text-[9px] font-bold text-muted-foreground">Owed: {formatCurrency(alert.outstandingBalance)}</p>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Ledger Healthy</p>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-8 px-3 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[9px] font-black text-primary uppercase tracking-widest">ONLINE</span>
            </div>
          </div>
        </>
      )}
    </header>
  )
}