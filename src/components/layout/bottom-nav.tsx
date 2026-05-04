
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingCart, Package, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/inventory", label: "Stock", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card border-t border-border flex items-center justify-around h-16 z-50">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full transition-colors",
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
    </nav>
  )
}
