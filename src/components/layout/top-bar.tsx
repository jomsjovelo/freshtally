'use client';

import { useState, useEffect } from "react"
import { useUser } from "@/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Store, Loader2, ShieldCheck } from "lucide-react"
import { usePathname } from "next/navigation"

export function TopBar() {
  const { tenant, isUserLoading, profile } = useUser()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isSuperAdmin = profile?.role === 'super_admin'

  // HYDRATION GUARD: Always render structural header shell
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 h-16 px-4 flex items-center justify-between">
      {mounted && pathname !== '/auth' && (
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
          
          <div className="flex items-center gap-2">
            <div className="h-8 px-3 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[9px] font-black text-primary uppercase tracking-widest">ONLINE</span>
            </div>
          </div>
        </>
      )}
    </header>
  )
}