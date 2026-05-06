"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword
} from "firebase/auth"
import { doc, getFirestore, serverTimestamp, writeBatch } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ShieldCheck, Loader2, AlertCircle, Store, KeyRound, CheckCircle2, Hash } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useUser } from "@/firebase"

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<"login" | "register_owner" | "join_staff">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [tenantIdInput, setTenantIdInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const { toast } = useToast()
  const auth = getAuth()
  const db = getFirestore()
  const { user: currentUser, profile, tenant, isUserLoading } = useUser()

  useEffect(() => {
    if (!isUserLoading && currentUser && profile?.tenantId && tenant) {
      router.push("/")
    }
  }, [currentUser, profile, tenant, isUserLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    
    // Validation for registration/recovery
    if (authMode !== "login") {
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify your entries.")
        return
      }
      if (password.length < 6) {
        setError("Security policy requires at least 6 characters.")
        return
      }
    }

    setLoading(true)
    try {
      if (authMode === "login") {
        // Standard login - Profile sync in Provider will handle the rest
        await signInWithEmailAndPassword(auth, normalizedEmail, password)
      } else {
        const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
        const user = res.user
        const batch = writeBatch(db)
        const profileRef = doc(db, "users", user.uid)

        if (authMode === "register_owner") {
          const tenantId = Math.floor(10000 + Math.random() * 90000).toString()
          const tenantRef = doc(db, "tenants", tenantId)

          batch.set(tenantRef, {
            id: tenantId,
            name: businessName,
            ownerUid: user.uid,
            status: "active",
            subscriptionPlan: "basic",
            currency: "PHP",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })

          batch.set(profileRef, {
            id: user.uid,
            email: normalizedEmail,
            role: "owner",
            tenantId: tenantId,
            displayName: ownerName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        } else {
          batch.set(profileRef, {
            id: user.uid,
            email: normalizedEmail,
            role: "staff",
            tenantId: tenantIdInput,
            displayName: ownerName || "Shop Staff",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        }

        await batch.commit()
        router.push("/")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isZombie = !!currentUser && (!profile?.tenantId || !tenant) && !isUserLoading

  const getButtonText = () => {
    if (loading) return null
    if (isZombie) return "RE-SYNC TERMINAL"
    if (authMode === "login") return "ENTER TERMINAL"
    if (authMode === "register_owner") return "INITIALIZE MARKET"
    return "JOIN STATION"
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F6FAFC]">
      <div className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-gray-100">
        <div className="text-center pt-12 pb-8 bg-primary text-white px-8 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md relative z-10 border border-white/30">
            {isZombie ? <Store className="h-7 w-7 text-white" /> : <ShieldCheck className="h-7 w-7 text-white" />}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none relative z-10">
            {isZombie ? "Terminal Recovery" : (authMode === "login" ? "Terminal Access" : "Market Entry")}
          </h1>
          <p className="text-[10px] font-bold text-white/70 mt-2 uppercase tracking-[0.2em] relative z-10">
            {isZombie ? "Re-syncing business node" : "FreshTally Cloud Ledger"}
          </p>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto">
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-none bg-red-50 text-red-700 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-[10px] font-black uppercase tracking-tight leading-tight">
                  {error}
                </AlertDescription>
              </div>
            </Alert>
          )}

          <Tabs value={authMode} onValueChange={(v: any) => {
            setAuthMode(v as any);
            setError(null);
          }} className="w-full">
            <TabsList className="grid grid-cols-3 h-12 bg-gray-50 border border-gray-100 rounded-2xl p-1 mb-6">
              <TabsTrigger value="login" className="rounded-xl text-[9px] font-black uppercase tracking-wider data-[state=active]:shadow-sm">LOGIN</TabsTrigger>
              <TabsTrigger value="register_owner" className="rounded-xl text-[9px] font-black uppercase tracking-wider data-[state=active]:shadow-sm">OWNER</TabsTrigger>
              <TabsTrigger value="join_staff" className="rounded-xl text-[9px] font-black uppercase tracking-wider data-[state=active]:shadow-sm">STAFF</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-5">
              {(authMode === "login" || authMode === "join_staff") && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Terminal ID</Label>
                  <div className="relative">
                    <Input 
                      placeholder="5-DIGIT CODE" 
                      maxLength={5}
                      className="h-14 rounded-2xl border-2 border-transparent bg-gray-50 focus:bg-white focus:border-primary/20 transition-all font-black px-5 pr-12 text-center tracking-[0.3em]"
                      value={tenantIdInput}
                      onChange={(e) => setTenantIdInput(e.target.value)}
                      required
                    />
                    <Hash className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-30" />
                  </div>
                </div>
              )}

              {authMode !== "login" && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                  <Input 
                    placeholder="e.g. Juan Dela Cruz" 
                    className="h-14 rounded-2xl border-2 border-transparent bg-gray-50 focus:bg-white focus:border-primary/20 transition-all font-bold px-5"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required
                  />
                </div>
              )}

              {authMode === "register_owner" && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Market Name</Label>
                  <Input 
                    placeholder="e.g. Metro Roast" 
                    className="h-14 rounded-2xl border-2 border-transparent bg-gray-50 focus:bg-white focus:border-primary/20 transition-all font-bold px-5"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cloud ID (Email)</Label>
                <Input 
                  type="email" 
                  placeholder="name@business.com" 
                  className="h-14 rounded-2xl border-2 border-transparent bg-gray-50 focus:bg-white focus:border-primary/20 transition-all font-bold px-5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Access Password</Label>
                <div className="relative">
                  <Input 
                    type="password" 
                    placeholder="Min. 6 characters" 
                    className="h-14 rounded-2xl border-2 border-transparent bg-gray-50 focus:bg-white focus:border-primary/20 transition-all font-bold px-5 pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <KeyRound className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-30" />
                </div>
              </div>

              {authMode !== "login" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Verify Password</Label>
                  <div className="relative">
                    <Input 
                      type="password" 
                      placeholder="Repeat password" 
                      className="h-14 rounded-2xl border-2 border-transparent bg-gray-50 focus:bg-white focus:border-primary/20 transition-all font-bold px-5 pr-12"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <CheckCircle2 className={`absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 transition-all ${password && password === confirmPassword ? "text-green-500 opacity-100" : "text-muted-foreground opacity-30"}`} />
                  </div>
                </div>
              )}

              <Button 
                type="submit"
                className="w-full h-16 rounded-[20px] bg-primary text-white font-black text-xs tracking-[0.15em] shadow-lg shadow-primary/20 mt-6 active:scale-[0.97] transition-all" 
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : getButtonText()}
              </Button>
            </form>
          </Tabs>
        </div>
        
        <div className="p-6 bg-gray-50/50 border-t border-gray-100 text-center">
          <p className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
            Authorized Access Only • Cloud Terminal V1.4
          </p>
        </div>
      </div>
    </div>
  )
}
