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
import { ShieldCheck, Loader2, AlertCircle, Store } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
    // REDIRECTION GUARD: Only redirect if the context is fully stable and consistent
    if (!isUserLoading && currentUser && profile?.tenantId && tenant) {
      router.push("/")
    }
  }, [currentUser, profile, tenant, isUserLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    
    if (authMode !== "login" && !currentUser && password !== confirmPassword) {
      toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, normalizedEmail, password)
      } else {
        let user = currentUser;
        if (!user) {
          const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
          user = res.user;
        }

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
            email: user.email || normalizedEmail,
            role: "owner",
            tenantId: tenantId,
            displayName: ownerName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true })
        } else {
          batch.set(profileRef, {
            id: user.uid,
            email: user.email || normalizedEmail,
            role: "staff",
            tenantId: tenantIdInput,
            displayName: ownerName || "Shop Staff",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true })
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <div className="w-full max-w-sm bg-white rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="text-center pt-10 pb-6 bg-primary text-white px-8 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="h-16 w-16 bg-white/20 rounded-[20px] flex items-center justify-center mx-auto mb-4 backdrop-blur-md relative z-10">
            {isZombie ? <Store className="h-8 w-8 text-white" /> : <ShieldCheck className="h-8 w-8 text-white" />}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none relative z-10">
            {isZombie ? "Re-Initialize" : (authMode === "login" ? "Terminal Access" : "Market Entry")}
          </h1>
        </div>

        <div className="p-8 pt-6 space-y-6 overflow-y-auto">
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-none bg-red-50 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs font-bold">{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={isZombie ? "register_owner" : authMode} onValueChange={(v: any) => setAuthMode(v as any)} className="w-full">
            {!isZombie && (
              <TabsList className="grid grid-cols-3 h-14 bg-gray-100 rounded-2xl p-1 mb-8">
                <TabsTrigger value="login" className="rounded-xl text-[10px] font-black uppercase">LOGIN</TabsTrigger>
                <TabsTrigger value="register_owner" className="rounded-xl text-[10px] font-black uppercase">OWNER</TabsTrigger>
                <TabsTrigger value="join_staff" className="rounded-xl text-[10px] font-black uppercase">STAFF</TabsTrigger>
              </TabsList>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {(authMode !== "login" || isZombie) && (
                <div className="space-y-5">
                  {(authMode === "join_staff" && !isZombie) && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Store ID</Label>
                      <Input 
                        placeholder="5-Digit ID" 
                        maxLength={5}
                        className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                        value={tenantIdInput}
                        onChange={(e) => setTenantIdInput(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                    <Input 
                      placeholder="e.g. Juan Dela Cruz" 
                      className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required
                    />
                  </div>

                  {(authMode === "register_owner" || isZombie) && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Name</Label>
                      <Input 
                        placeholder="e.g. Metro Roast" 
                        className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {!currentUser && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email</Label>
                    <Input 
                      type="email" 
                      placeholder="name@business.com" 
                      className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Password</Label>
                    <Input 
                      type="password" 
                      placeholder="Min 6 characters" 
                      className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <Button 
                type="submit"
                className="w-full h-16 rounded-[24px] bg-primary text-white font-black text-sm shadow-xl mt-6" 
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isZombie ? "INITIALIZE BUSINESS" : "SUBMIT")}
              </Button>
            </form>
          </Tabs>
        </div>
      </div>
    </div>
  )
}