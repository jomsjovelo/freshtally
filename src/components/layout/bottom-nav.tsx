'use client';

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingCart, Package, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/provider"

export function BottomNav() {
  const pathname = usePathname()
  const { profile, tenant, isUserLoading } = useUser()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Hydration Stability: Always render the parent nav tag to ensure structural consistency across SSR/CSR
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-gray-100 flex items-center justify-around h-20 z-50 px-2 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      {mounted && pathname !== '/auth' && !isUserLoading && (tenant?.status !== 'suspended' || profile?.role === 'super_admin') && (
        <>
          {[
            { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ['owner', 'staff', 'super_admin'] },
            { href: "/pos", label: "POS", icon: ShoppingCart, roles: ['staff', 'owner'] },
            { href: "/inventory", label: "Inventory", icon: Package, roles: ['staff', 'owner'] },
            { href: "/settings", label: "Settings", icon: Settings, roles: ['owner', 'staff', 'super_admin'] },
          ].filter(item => !item.roles || item.roles.includes(profile?.role || '')).map((item) => {
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
        </>
      )}
    </nav>
  )
}