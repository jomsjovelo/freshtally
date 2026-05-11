'use client';

import { useState, useEffect, useMemo } from "react"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Store, Loader2, ShieldCheck, Bell, Share2, AlertCircle } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"

export function TopBar() {
  const [mounted, setMounted] = useState(false);
  const { tenant, isUserLoading, profile, user } = useUser();
  const db = useFirestore();
  const pathname = usePathname();
  const { toast } = useToast();

  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const overdueClientsQuery = useMemoFirebase(() => {
    if (!mounted || !db || !tenant?.id || !profile?.tenantId) return null;
    if (tenant.id !== profile.tenantId) return null;

    const canSeeAr = profile.role === 'owner' || profile.role === 'manager' || profile.role === 'super_admin';
    if (!canSeeAr) return null;
    
    return query(
      collection(db, "tenants", tenant.id, "b2bClients"),
      where("outstandingBalance", ">", 0)
    );
  }, [mounted, db, tenant?.id, profile?.tenantId, profile?.role]);

  const { data: b2bClients } = useCollection(overdueClientsQuery);

  const alerts = useMemo(() => {
    if (!b2bClients) return [];
    return b2bClients
      .map(client => ({
        ...client,
        category: getAgingCategory(client.oldestUnpaidAt)
      }))
      .filter(c => c.category !== 'current');
  }, [b2bClients]);

  const isSuperAdmin = profile?.role === 'super_admin';

  const isSubscriptionExpiring = useMemo(() => {
    if (!tenant?.expiryDate) return false;
    const expiry = new Date(tenant.expiryDate);
    const diff = expiry.getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  }, [tenant?.expiryDate]);

  const hasAlerts = alerts.length > 0 || isSubscriptionExpiring;

  const handleShareReminder = async (client: any) => {
    const message = `Hello ${client.name}, this is a friendly reminder from ${tenant?.name} regarding your outstanding balance of ${formatCurrency(client.outstandingBalance)}. Please let us know when we can expect settlement. Thank you!`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Payment Reminder',
          text: message,
        });
      } catch (err) {
        await navigator.clipboard.writeText(message)
        toast({ title: "Reminder Copied", description: "Message saved to clipboard." })
      }
    } else {
      await navigator.clipboard.writeText(message)
      toast({ title: "Reminder Copied", description: "System doesn't support native share. Message saved to clipboard." })
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 h-16 px-4 flex items-center justify-between">
      {!mounted ? (
        <div className="h-10 w-full bg-gray-100 rounded-xl" />
      ) : (
        user && pathname !== '/auth' && (
          <>
            <div className="flex items-center gap-3 overflow-hidden">
              {isUserLoading ? (
                <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
                </div>
              ) : (
                <>
                  <Avatar className="h-9 w-9 rounded-xl border border-gray-200 shadow-sm bg-white p-1.5">
                    <AvatarImage src={isSuperAdmin ? undefined : (tenant?.logoUrl || "/logo.png")} alt={tenant?.name || 'User'} className="object-contain" />
                    <AvatarFallback className={isSuperAdmin ? "bg-accent text-white" : "bg-primary/5 text-primary"}>
                      {isSuperAdmin ? <ShieldCheck className="h-5 w-5" /> : <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain" />}
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
                    <Bell className={cn("h-5 w-5", hasAlerts ? "text-destructive animate-pulse" : "text-muted-foreground")} />
                    {hasAlerts && (
                      <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-destructive rounded-full border-2 border-white" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 rounded-[24px] border-none shadow-2xl p-2 mt-2">
                  <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground p-3">
                    Alert Center
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isSubscriptionExpiring && (
                    <DropdownMenuItem className="p-3 m-2 rounded-xl bg-amber-50 text-amber-800 focus:bg-amber-100 cursor-default flex flex-col items-start gap-1">
                      <span className="font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" /> Subscription Warning
                      </span>
                      <p className="text-[9px] font-bold">Your subscription expires within 7 days. Renew to avoid interruption.</p>
                    </DropdownMenuItem>
                  )}
                  {alerts.length > 0 ? (
                    alerts.map(alert => (
                      <DropdownMenuItem key={alert.id} className="p-3 rounded-xl focus:bg-gray-50 cursor-pointer flex flex-col items-start gap-1">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col">
                            <span className="font-black text-[11px] uppercase truncate">{alert.name}</span>
                            <p className="text-[9px] font-bold text-muted-foreground">Owed: {formatCurrency(alert.outstandingBalance)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={alert.category === 'critical' ? 'destructive' : 'default'} className="text-[7px] uppercase px-1.5 h-4 font-black">
                              {alert.category}
                            </Badge>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareReminder(alert);
                              }}
                              className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">No urgent alerts</p>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className={cn(
                "h-8 px-4 rounded-full flex items-center justify-center transition-all",
                isOnline ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700 animate-pulse"
              )}>
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {isOnline ? "Online" : "Connection Lost"}
                </span>
              </div>
            </div>
          </>
        )
      )}
    </header>
  )
}