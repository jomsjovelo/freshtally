
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingCart, Package, Settings, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/provider"

export function BottomNav() {
  const pathname = usePathname()
  const { profile, tenant } = useUser()

  if (tenant?.status === 'suspended') return null;

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ['owner', 'super_admin'] },
    { href: "/pos", label: "POS", icon: ShoppingCart, roles: ['staff', 'owner', 'super_admin'] },
    { href: "/inventory", label: "Stock", icon: Package, roles: ['staff', 'owner', 'super_admin'] },
    { href: "/settings", label: "Settings", icon: Settings, roles: ['owner', 'super_admin'] },
  ]

  const filteredItems = navItems.filter(item => 
    profile?.role === 'super_admin' || (profile?.role && item.roles.includes(profile.role))
  )

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card border-t border-border flex items-center justify-around h-16 z-50">
      {filteredItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full transition-colors relative",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("h-6 w-6", isActive && "fill-current")} />
            <span className="text-[10px] font-medium mt-1 uppercase tracking-wider">
              {item.label}
            </span>
            {isActive && (
              <div className="absolute top-0 w-12 h-1 bg-primary rounded-b-full" />
            )}
          </Link>
        )
      })}
      {profile?.role === 'super_admin' && (
        <Link
          href="/super-admin"
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full transition-colors",
            pathname === "/super-admin" ? "text-accent" : "text-muted-foreground"
          )}
        >
          <ShieldAlert className="h-6 w-6" />
          <span className="text-[10px] font-medium mt-1 uppercase tracking-wider">SaaS</span>
        </Link>
      )}
    </nav>
  )
}
