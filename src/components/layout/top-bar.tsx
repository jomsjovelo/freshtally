"use client"

import { useUser } from "@/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Store, Loader2 } from "lucide-react"
import { usePathname } from "next/navigation"

export function TopBar() {
  const { tenant, isUserLoading, profile } = useUser()
  const pathname = usePathname()

  // Hide on auth/onboarding
  if (pathname === '/auth' || pathname === '/onboarding') return null

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 h-16 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3 overflow-hidden">
        {isUserLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Avatar className="h-9 w-9 rounded-xl border border-gray-200 shadow-sm">
              <AvatarImage src={tenant?.logoUrl} alt={tenant?.name} />
              <AvatarFallback className="bg-primary/5 text-primary">
                <Store className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase tracking-tighter truncate leading-none">
                {profile?.role === 'super_admin' ? 'GENESIS TERMINAL' : (tenant?.name || 'Loading...')}
              </h2>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5 truncate">
                {profile?.role === 'super_admin' ? 'SYSTEM OVERVIEW' : (profile?.role || 'STAFF')}
              </p>
            </div>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <div className="h-8 px-3 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-[9px] font-black text-primary uppercase tracking-widest">LIVE</span>
        </div>
      </div>
    </header>
  )
}
