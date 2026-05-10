'use client';

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingCart, Package, Settings, HandCoins } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/provider"

export function BottomNav() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { profile, tenant, isUserLoading, user } = useUser();

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-gray-100 flex items-center justify-around h-20 z-50 px-2 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      {!mounted ? (
        <div className="h-12 w-full bg-gray-100 rounded-2xl mx-4" />
      ) : (
        pathname !== '/auth' && user && !isUserLoading && (tenant || profile?.role === 'super_admin') && (
          <>
            {[
              { href: "/", label: "Home", icon: LayoutDashboard, roles: ['owner', 'staff', 'manager', 'super_admin'] },
              { href: "/pos", label: "Sell", icon: ShoppingCart, roles: ['staff', 'owner', 'manager'] },
              { href: "/inventory", label: "Items", icon: Package, roles: ['staff', 'owner', 'manager'] },
              { href: "/accounts", label: "Accounts", icon: HandCoins, roles: ['owner', 'manager'] },
              { href: "/settings", label: "Settings", icon: Settings, roles: ['owner', 'staff', 'manager', 'super_admin'] },
            ].filter(item => item.roles.includes(profile?.role || '')).map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full transition-all relative",
                    isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground opacity-60"
                  )}
                >
                  <Icon className={cn("h-6 w-6", isActive && "fill-current")} />
                  <span className="text-[9px] font-black mt-1.5 uppercase tracking-widest">
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="absolute -top-1 w-8 h-1 bg-primary rounded-full" />
                  )}
                </Link>
              )
            })}
            <div className="absolute -top-10 right-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full shadow-soft border border-gray-100 flex items-center gap-2 animate-in slide-in-from-bottom-2">
              <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", isOnline ? "bg-green-500" : "bg-red-500")} />
              <span className="text-[8px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                {isOnline ? "Online" : "Offline Mode"}
              </span>
            </div>
          </>
        )
      )}
    </nav>
  )
}