"use client"

import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Store, 
  ShieldCheck, 
  CreditCard, 
  LogOut, 
  ChevronRight, 
  Bell, 
  Moon,
  Globe,
  Loader2
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase"
import { getAuth, signOut } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const { profile, tenant, isUserLoading } = useUser()
  const router = useRouter()
  const auth = getAuth()

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/auth')
  }

  if (isUserLoading) {
    return (
      <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        Fetching Configuration...
      </div>
    )
  }

  const isSuperAdmin = profile?.role === 'super_admin'

  return (
    <div className="p-4 space-y-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your FreshTally experience</p>
      </header>

      <div className="bg-primary p-6 rounded-3xl flex items-center gap-4 text-white shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700" />
        <Avatar className="h-16 w-16 border-4 border-white/20 shadow-xl">
          <AvatarImage src={isSuperAdmin ? undefined : tenant?.logoUrl} />
          <AvatarFallback className={isSuperAdmin ? "bg-accent text-white font-bold" : "bg-secondary text-primary font-bold"}>
            {profile?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 z-10">
          <h2 className="text-lg font-bold">{profile?.name || 'User Profile'}</h2>
          <p className="text-white/70 text-sm uppercase font-black tracking-widest text-[10px]">
            {isSuperAdmin ? 'Platform Admin' : (profile?.role === 'owner' ? 'Store Owner' : 'Shop Staff')}
          </p>
          <div className="flex gap-2 mt-2">
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
              {isSuperAdmin ? 'Global Access' : (tenant?.name || 'Registered Store')}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">Configuration</h3>
          <div className="space-y-2">
            {[
              { icon: Store, label: "Profile", description: "Name, logo, and location", color: "text-blue-500", roles: ['owner', 'super_admin'] },
              { icon: ShieldCheck, label: "Security", description: "Manage roles & access", color: "text-purple-500", roles: ['owner', 'super_admin'] },
              { icon: CreditCard, label: "Payments", description: "Configure terminal settings", color: "text-green-500", roles: ['owner'] },
            ].filter(item => !item.roles || item.roles.includes(profile?.role || '')).map((item) => (
              <button key={item.label} className="w-full bg-card p-4 rounded-2xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn("h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center", item.color)}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">App Preferences</h3>
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="notifications" className="text-sm font-semibold">Push Notifications</Label>
                </div>
                <Switch id="notifications" defaultChecked />
              </div>
              <div className="p-4 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-3">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="dark-mode" className="text-sm font-semibold">Dark Mode Appearance</Label>
                </div>
                <Switch id="dark-mode" />
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Region & Currency</Label>
                </div>
                <span className="text-xs text-muted-foreground font-bold">{tenant?.currency || 'PHP'} (₱)</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <Button 
          variant="destructive" 
          className="w-full h-14 rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-red-100"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sign Out Account
        </Button>
      </div>

      <BottomNav />
    </div>
  )
}
