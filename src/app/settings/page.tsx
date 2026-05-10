"use client"

import { BottomNav } from "@/components/layout/bottom-nav"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Store, 
  ShieldCheck, 
  CreditCard, 
  Package,
  LogOut, 
  ChevronRight, 
  Bell, 
  Moon,
  Globe,
  Loader2,
  Copy,
  MapPin,
  Hash
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { signOut } from "firebase/auth"
import { doc, updateDoc, query, collection, where, limit } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"

export default function SettingsPage() {
  const { profile, tenant, isUserLoading } = useUser()
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()
  const { toast } = useToast()
  const [isDark, setIsDark] = useState(false)
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)
  const [isStaffOpen, setIsStaffOpen] = useState(false)
  const [isBusinessOpen, setIsBusinessOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatIcon, setNewCatIcon] = useState("✨")
  const [isUpdating, setIsUpdating] = useState(false)
  
  const staffQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(collection(db, "userProfiles"), where("tenantId", "==", tenant.id), limit(20))
  }, [db, tenant?.id])

  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery)

  useEffect(() => {
    const stored = localStorage.getItem('freshtally-theme')
    if (stored === 'dark') {
      document.documentElement.classList.add('dark')
      setIsDark(true)
    }
  }, [])

  const toggleDark = (checked: boolean) => {
    document.documentElement.classList.toggle('dark', checked)
    localStorage.setItem('freshtally-theme', checked ? 'dark' : 'light')
    setIsDark(checked)
  }

  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!db || !tenant?.id) return
    try {
      const tenantRef = doc(db, "tenants", tenant.id)
      await updateDoc(tenantRef, { currency: e.target.value })
      toast({ title: "Currency Updated", description: `Default currency set to ${e.target.value}.` })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleSignOut = async () => {
    if (!auth) return
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

  const handleAddCategory = async () => {
    if (!db || !tenant?.id || !newCatName.trim()) return
    setIsUpdating(true)
    try {
      const tenantRef = doc(db, "tenants", tenant.id)
      const newCategory = {
        id: `cat-${Date.now()}`,
        name: newCatName.trim(),
        icon: newCatIcon
      }
      const updatedCategories = [...(tenant.categories || []), newCategory]
      await updateDoc(tenantRef, { categories: updatedCategories })
      setNewCatName("")
      toast({ title: "Category Added", description: `${newCatName} is now available.` })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemoveCategory = async (catId: string) => {
    if (!db || !tenant?.id) return
    setIsUpdating(true)
    try {
      const tenantRef = doc(db, "tenants", tenant.id)
      const updatedCategories = (tenant.categories || []).filter((c: any) => c.id !== catId)
      await updateDoc(tenantRef, { categories: updatedCategories })
      toast({ title: "Category Removed" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsUpdating(false)
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

      <div className="bg-primary p-7 rounded-[40px] flex items-center gap-5 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 transition-transform group-hover:scale-125 duration-1000" />
        <Avatar className="h-20 w-20 border-4 border-white/20 shadow-2xl rounded-[24px]">
          <AvatarImage src={isSuperAdmin ? undefined : tenant?.logoUrl} className="object-cover" />
          <AvatarFallback className={cn(
            "rounded-[20px] font-black text-2xl",
            isSuperAdmin ? "bg-accent text-white" : "bg-white text-primary"
          )}>
            {profile?.displayName?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 z-10 min-w-0">
          <h2 className="text-xl font-black uppercase tracking-tight truncate leading-tight">{profile?.displayName || 'Authorized User'}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[8px] bg-white/20 px-3 py-1 rounded-full font-black uppercase tracking-widest backdrop-blur-md">
              {profile?.role?.toUpperCase()}
            </span>
            <span className="text-[8px] bg-black/20 px-3 py-1 rounded-full font-black uppercase tracking-widest backdrop-blur-md">
              {isSuperAdmin ? 'SUPER ADMIN' : (tenant?.name || 'REGISTERED STORE')}
            </span>
          </div>
        </div>
      </div>

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

      {isOwner && tenant && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Team Access</h3>
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

      <div className="space-y-8">
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Store Profile</h3>
          <div className="space-y-2">
            {[
              { icon: ShieldCheck, label: "Staff & Roles", description: "Manage team access", color: "text-purple-500", roles: ['owner', 'super_admin'] },
              { icon: Package, label: "Categories", description: "Manage product groups", color: "text-blue-500", roles: ['owner'] },
              { icon: CreditCard, label: "Business Tools", description: "Payment settings", color: "text-green-500", roles: ['owner'] },
            ].filter(item => !item.roles || item.roles.includes(profile?.role || '')).map((item) => (
              <button 
                key={item.label} 
                onClick={() => {
                  if (item.label === "Categories") setIsCategoriesOpen(true)
                  if (item.label === "Staff & Roles") setIsStaffOpen(true)
                  if (item.label === "Business Tools") setIsBusinessOpen(true)
                }}
                className="w-full bg-white p-5 rounded-[28px] flex items-center justify-between shadow-sm active:scale-[0.98] transition-all border border-gray-50"
              >
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
                  <Label htmlFor="notifications" className="text-xs font-black uppercase tracking-widest">Notifications</Label>
                </div>
                <Switch id="notifications" defaultChecked />
              </div>
              <div className="p-6 flex items-center justify-between border-b border-gray-50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center">
                    <Moon className="h-5 w-5" />
                  </div>
                  <Label htmlFor="dark-mode" className="text-xs font-black uppercase tracking-widest">Dark Mode</Label>
                </div>
                <Switch 
                  id="dark-mode" 
                  checked={isDark} 
                  onCheckedChange={toggleDark}
                />
              </div>
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center">
                    <Globe className="h-5 w-5" />
                  </div>
                  <Label htmlFor="store-currency" className="text-xs font-black uppercase tracking-widest">Store Currency</Label>
                </div>
                <select 
                  id="store-currency"
                  name="store-currency"
                  className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full border-none outline-none"
                  value={tenant?.currency || 'PHP'}
                  onChange={handleCurrencyChange}
                >
                  <option value="PHP">PHP (₱)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="SGD">SGD (S$)</option>
                </select>
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
          SIGN OUT
        </Button>
      </div>

      <Dialog open={isCategoriesOpen} onOpenChange={setIsCategoriesOpen}>
        <DialogContent className="max-w-md w-full h-[80vh] rounded-t-[40px] border-none p-0 bg-white overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader className="p-10 pb-6 bg-blue-500 text-white relative">
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Manage Categories</DialogTitle>
            <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Custom product grouping</DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-8 overflow-y-auto flex-1 pb-32">
            <div className="space-y-4">
              <Label htmlFor="new-category-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Add New Category</Label>
              <div className="flex gap-2">
                <Input 
                  id="new-category-name"
                  name="new-category-name"
                  placeholder="e.g. Snacks" 
                  className="h-14 rounded-2xl bg-gray-50 border-none font-bold px-6 flex-1"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  autoComplete="off"
                />
                <select 
                  id="new-category-icon"
                  name="new-category-icon"
                  className="h-14 w-16 rounded-2xl bg-gray-50 border-none text-2xl flex items-center justify-center text-center outline-none"
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                >
                  <option value="✨">✨</option>
                  <option value="🥦">🥦</option>
                  <option value="🍎">🍎</option>
                  <option value="🥩">🥩</option>
                  <option value="🐟">🐟</option>
                  <option value="🥚">🥚</option>
                  <option value="📦">📦</option>
                  <option value="🥛">🥛</option>
                  <option value="🍺">🍺</option>
                  <option value="🥖">🥖</option>
                  <option value="🍬">🍬</option>
                </select>
                <Button 
                  size="icon" 
                  className="h-14 w-14 rounded-2xl bg-blue-500 shadow-lg shadow-blue-200 active:scale-90 transition-all"
                  onClick={handleAddCategory}
                  disabled={isUpdating || !newCatName.trim()}
                >
                  {isUpdating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6" />}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Current Categories</Label>
              <div className="space-y-2">
                {tenant?.categories?.map((cat: any) => (
                  <div key={cat.id} className="bg-gray-50 p-5 rounded-[24px] flex items-center justify-between border border-gray-100">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="font-bold uppercase tracking-tight text-sm">{cat.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 text-destructive hover:bg-destructive/5 rounded-xl"
                      onClick={() => handleRemoveCategory(cat.id)}
                      disabled={isUpdating}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isStaffOpen} onOpenChange={setIsStaffOpen}>
        <DialogContent className="max-w-md w-full h-[80vh] rounded-t-[40px] border-none p-0 bg-white overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader className="p-10 pb-6 bg-purple-500 text-white">
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Team & Roles</DialogTitle>
            <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Manage store permissions</DialogDescription>
          </DialogHeader>
          <div className="p-8 flex-1 overflow-y-auto space-y-4">
            {isStaffLoading ? (
              <div className="p-20 text-center animate-pulse text-[10px] font-black uppercase tracking-widest opacity-40">Syncing Team...</div>
            ) : staff && staff.length > 0 ? (
              staff.map((member: any) => (
                <div key={member.id} className="bg-gray-50 p-5 rounded-[28px] flex items-center justify-between border border-gray-100">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 rounded-xl border border-white">
                      <AvatarFallback className="bg-purple-100 text-purple-600 font-black text-[10px]">
                        {member.displayName?.charAt(0).toUpperCase() || member.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm uppercase tracking-tight">{member.displayName || 'Unnamed Staff'}</p>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{member.role}</p>
                    </div>
                  </div>
                  {isOwner && member.id !== profile?.id && (
                    <Select 
                      value={member.role} 
                      onValueChange={async (newRole) => {
                        if (!db) return
                        try {
                          await updateDoc(doc(db, "userProfiles", member.id), { role: newRole })
                          toast({ title: "Role Updated", description: `${member.displayName} is now a ${newRole}.` })
                        } catch (e: any) {
                          toast({ title: "Error", description: e.message, variant: "destructive" })
                        }
                      }}
                    >
                      <SelectTrigger 
                        id={`staff-role-trigger-${member.id}`}
                        name={`staff-role-trigger-${member.id}`}
                        className="w-24 h-10 rounded-xl border-none bg-white text-[9px] font-black uppercase"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none">
                        <SelectItem value="staff" className="text-[9px] font-black uppercase">Staff</SelectItem>
                        <SelectItem value="manager" className="text-[9px] font-black uppercase">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))
            ) : (
              <div className="p-20 text-center opacity-40 italic">No staff members found.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBusinessOpen} onOpenChange={setIsBusinessOpen}>
        <DialogContent className="max-w-md w-full h-[80vh] rounded-t-[40px] border-none p-0 bg-white overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader className="p-10 pb-6 bg-green-500 text-white">
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Business Tools</DialogTitle>
            <DialogDescription className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Edit Store Profile</DialogDescription>
          </DialogHeader>
          <div className="p-8 flex-1 overflow-y-auto space-y-6 pb-32">
            <div className="space-y-2">
              <Label htmlFor="business-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Store Name</Label>
              <Input 
                id="business-name"
                name="business-name"
                defaultValue={tenant?.name} 
                onBlur={async (e) => {
                  if (!db || !tenant?.id) return
                  await updateDoc(doc(db, "tenants", tenant.id), { name: e.target.value })
                  toast({ title: "Name Updated" })
                }}
                className="h-14 rounded-2xl bg-gray-50 border-none font-bold px-6"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-address" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Address</Label>
              <Input 
                id="business-address"
                name="business-address"
                defaultValue={tenant?.address} 
                onBlur={async (e) => {
                  if (!db || !tenant?.id) return
                  await updateDoc(doc(db, "tenants", tenant.id), { address: e.target.value })
                  toast({ title: "Address Updated" })
                }}
                className="h-14 rounded-2xl bg-gray-50 border-none font-bold px-6"
                autoComplete="street-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-logo" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Logo URL</Label>
              <Input 
                id="business-logo"
                name="business-logo"
                defaultValue={tenant?.logoUrl} 
                onBlur={async (e) => {
                  if (!db || !tenant?.id) return
                  await updateDoc(doc(db, "tenants", tenant.id), { logoUrl: e.target.value })
                  toast({ title: "Logo Updated" })
                }}
                placeholder="https://..."
                className="h-14 rounded-2xl bg-gray-50 border-none font-bold px-6"
                autoComplete="url"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  )
}
