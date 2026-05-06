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
  Loader2,
  Copy,
  UserPlus,
  MapPin,
  Hash
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase"
import { getAuth, signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { profile, tenant, isUserLoading } = useUser()
  const router = useRouter()
  const auth = getAuth()
  const { toast } = useToast()

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/auth')
  }

  const copyStoreCode = () => {
    if (tenant?.id) {
      navigator.clipboard.writeText(tenant.id)
      toast({ 
        title: "Store Code Copied", 
        description: "Share this unique code with your staff to join the store.",
        duration: 3000
      })
    }
  }

  if (isUserLoading) {
    return (
      <div className="p-8 text-center animate-pulse font-bold text-primary uppercase text-xs tracking-widest mt-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        Syncing Preferences...
      </div>
    )
  }

  const isSuperAdmin = profile?.role === 'super_admin'
  const isOwner = profile?.role === 'owner'

  return (
    <div className="p-4 space-y-6 pb-28">
      <header className="px-1">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">Settings</h1>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Configure your ecosystem</p>
      </header>

      {/* USER PROFILE HEADER */}
      <div className="bg-primary p-7 rounded-[40px] flex items-center gap-5 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 transition-transform group-hover:scale-125 duration-1000" />
        <Avatar className="h-20 w-20 border-4 border-white/20 shadow-2xl rounded-[24px]">
          <AvatarImage src={isSuperAdmin ? undefined : tenant?.logoUrl} className="object-cover" />
          <AvatarFallback className={cn(
            "rounded-[20px] font-black text-2xl",
            isSuperAdmin ? "bg-accent text-white" : "bg-white text-primary"
          )}>
            {profile?.name?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 z-10 min-w-0">
          <h2 className="text-xl font-black uppercase tracking-tight truncate leading-tight">{profile?.name || 'Authorized User'}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[8px] bg-white/20 px-3 py-1 rounded-full font-black uppercase tracking-widest backdrop-blur-md">
              {isSuperAdmin ? 'PLATFORM OWNER' : (profile?.role === 'owner' ? 'BUSINESS OWNER' : 'STORE STAFF')}
            </span>
            <span className="text-[8px] bg-black/20 px-3 py-1 rounded-full font-black uppercase tracking-widest backdrop-blur-md">
              {isSuperAdmin ? 'GENESIS' : (tenant?.name || 'REGISTERED STORE')}
            </span>
          </div>
        </div>
      </div>

      {/* STORE IDENTITY (OWNER ONLY) */}
      {!isSuperAdmin && tenant && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Business Identity</h3>
          <Card className="border-none shadow-sm bg-white rounded-[32px] overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-primary shrink-0">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Store Name</p>
                  <p className="font-bold text-foreground truncate">{tenant.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-primary shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Location</p>
                  <p className="font-bold text-foreground line-clamp-2">{tenant.address || 'Address Not Set'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* STAFF ONBOARDING (OWNER ONLY) */}
      {isOwner && tenant && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Expansion Tools</h3>
          <Card className="border-none shadow-xl bg-accent/5 rounded-[32px] overflow-hidden">
            <CardContent className="p-8 flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 text-accent">
                  <Hash className="h-4 w-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Store Code</p>
                </div>
                <p className="text-4xl font-black font-mono tracking-tighter text-foreground select-all">{tenant.id}</p>
                <p className="text-[9px] text-muted-foreground font-bold mt-2 uppercase tracking-widest opacity-60">
                  Provide this code to your staff.
                </p>
              </div>
              <Button 
                size="icon" 
                className="h-16 w-16 rounded-[24px] bg-accent hover:bg-accent/90 shadow-lg active:scale-90 transition-all shrink-0" 
                onClick={copyStoreCode}
              >
                <Copy className="h-7 w-7" />
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* SYSTEM CONFIGURATION */}
      <div className="space-y-8">
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Store Node</h3>
          <div className="space-y-2">
            {[
              { icon: ShieldCheck, label: "Access Control", description: "Roles and permissions", color: "text-purple-500", roles: ['owner', 'super_admin'] },
              { icon: CreditCard, label: "Financials", description: "Payment node config", color: "text-green-500", roles: ['owner'] },
            ].filter(item => !item.roles || item.roles.includes(profile?.role || '')).map((item) => (
              <button key={item.label} className="w-full bg-white p-5 rounded-[28px] flex items-center justify-between shadow-sm active:scale-[0.98] transition-all border border-gray-50">
                <div className="flex items-center gap-4">
                  <div className={cn("h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center", item.color)}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black uppercase tracking-tight">{item.label}</p>
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-60">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/30" />
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Environment</h3>
          <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-white">
            <CardContent className="p-0">
              <div className="p-6 flex items-center justify-between border-b border-gray-50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                    <Bell className="h-5 w-5" />
                  </div>
                  <Label htmlFor="notifications" className="text-xs font-black uppercase tracking-widest">Push Dispatch</Label>
                </div>
                <Switch id="notifications" defaultChecked />
              </div>
              <div className="p-6 flex items-center justify-between border-b border-gray-50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center">
                    <Moon className="h-5 w-5" />
                  </div>
                  <Label htmlFor="dark-mode" className="text-xs font-black uppercase tracking-widest">Shadow Mode</Label>
                </div>
                <Switch id="dark-mode" />
              </div>
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center">
                    <Globe className="h-5 w-5" />
                  </div>
                  <Label className="text-xs font-black uppercase tracking-widest">Node Region</Label>
                </div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full">
                  {tenant?.currency || 'PHP'} (₱)
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        <Button 
          variant="destructive" 
          className="w-full h-20 rounded-[32px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-red-100 active:scale-95 transition-all"
          onClick={handleSignOut}
        >
          <LogOut className="h-6 w-6 mr-3" />
          TERMINATE SESSION
        </Button>
      </div>

      <BottomNav />
    </div>
  )
}
