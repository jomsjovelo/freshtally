
"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, ShoppingCart, Package, Settings, ShieldAlert, LogOut, ChartBar, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/provider"
import { getAuth, signOut } from "firebase/auth"

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, tenant, isUserLoading, user } = useUser()

  if (pathname === '/auth' || pathname === '/onboarding') return null;
  if (tenant?.status === 'suspended' && profile?.role !== 'super_admin') return null;

  const handleSignOut = async () => {
    await signOut(getAuth())
    router.push('/auth')
  }

  // Tenant/Owner/Staff Nav
  const tenantNav = [
    { href: "/", label: "Home", icon: LayoutDashboard, roles: ['owner', 'staff'] },
    { href: "/pos", label: "POS", icon: ShoppingCart, roles: ['staff', 'owner'] },
    { href: "/inventory", label: "Stock", icon: Package, roles: ['staff', 'owner'] },
    { href: "/settings", label: "Set", icon: Settings, roles: ['owner', 'staff'] },
  ]

  // Super Admin Nav
  const adminNav = [
    { href: "/", label: "Hub", icon: LayoutDashboard, roles: ['super_admin'] },
    { href: "/super-admin", label: "Tenants", icon: Users, roles: ['super_admin'] },
    { href: "/settings", label: "Config", icon: Settings, roles: ['super_admin'] },
  ]

  const navItems = profile?.role === 'super_admin' ? adminNav : tenantNav

  const filteredItems = (!profile || isUserLoading) 
    ? [] 
    : navItems.filter(item => item.roles.includes(profile.role))

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-gray-100 flex items-center justify-around h-20 z-50 px-2 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      {filteredItems.map((item) => {
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
            <span className="text-[9px] font-black mt-1 uppercase tracking-widest">
              {item.label}
            </span>
            {isActive && (
              <div className="absolute -top-1 w-8 h-1 bg-primary rounded-full" />
            )}
          </Link>
        )
      })}

      {user && (
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground opacity-40 hover:opacity-100 transition-opacity"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[9px] font-black mt-1 uppercase tracking-widest">EXIT</span>
        </button>
      )}
    </nav>
  )
}
