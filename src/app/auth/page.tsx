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
import { ShieldCheck, Loader2, AlertCircle, MapPin } from "lucide-react"
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
  const [storeAddress, setStoreAddress] = useState("")
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
    
    if (authMode !== "login") {
      if (password !== confirmPassword) {
        toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" })
        return
      }
      if (password.length < 6) {
        toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" })
        return
      }
    }

    setLoading(true)
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, normalizedEmail, password)
      } else if (authMode === "register_owner") {
        if (!businessName.trim()) throw new Error("Business name is required.")
        if (!ownerName.trim()) throw new Error("Full name is required.")
        if (!storeAddress.trim()) throw new Error("Business address is required.")

        let user;
        if (currentUser) {
          user = currentUser;
        } else {
          const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
          user = res.user;
        }

        const batch = writeBatch(db)
        const tenantId = Math.floor(10000 + Math.random() * 90000).toString()
        const tenantRef = doc(db, "tenants", tenantId)
        const profileRef = doc(db, "users", user.uid)

        batch.set(tenantRef, {
          id: tenantId,
          name: businessName,
          ownerName: ownerName,
          address: storeAddress,
          status: "active",
          subscriptionPlan: "basic",
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          ownerUid: user.uid,
          ownerEmail: normalizedEmail,
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

        await batch.commit()
        toast({ title: "Store Created", description: `${businessName} is live with ID: ${tenantId}.` })
        router.push("/")
      } else if (authMode === "join_staff") {
        if (!tenantIdInput.trim()) throw new Error("5-Digit Store ID is required.")
        
        let user;
        if (currentUser) {
          user = currentUser;
        } else {
          const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
          user = res.user;
        }

        const profileRef = doc(db, "users", user.uid)

        await writeBatch(db)
          .set(profileRef, {
            id: user.uid,
            email: normalizedEmail,
            role: "staff",
            tenantId: tenantIdInput,
            displayName: ownerName || "Shop Staff",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true })
          .commit()

        toast({ title: "Access Granted", description: `Joining team...` })
        router.push("/")
      }
    } catch (err: any) {
      setError(err.message)
      toast({ title: "Authentication Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <div className="w-full max-w-sm bg-white rounded-[48px] shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[95vh]">
        <div className="text-center pt-10 pb-6 bg-primary text-white px-8 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="h-16 w-16 bg-white/20 rounded-[20px] flex items-center justify-center mx-auto mb-4 backdrop-blur-md relative z-10">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none relative z-10">
            {authMode === "login" ? "Terminal Access" : "Market Entry"}
          </h1>
          <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mt-2 relative z-10">
            FreshTally SaaS • Multi-Tenant
          </p>
        </div>

        <div className="p-8 pt-6 space-y-6 overflow-y-auto">
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-none bg-red-50 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-[10px] font-black uppercase tracking-widest">Auth Error</AlertTitle>
              <AlertDescription className="text-xs font-bold">{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={authMode} onValueChange={(v: any) => { setAuthMode(v as any); setError(null); }} className="w-full">
            <TabsList className="grid grid-cols-3 h-14 bg-gray-100 rounded-2xl p-1 mb-8">
              <TabsTrigger value="login" className="rounded-xl text-[10px] font-black uppercase">LOGIN</TabsTrigger>
              <TabsTrigger value="register_owner" className="rounded-xl text-[10px] font-black uppercase">OWNER</TabsTrigger>
              <TabsTrigger value="join_staff" className="rounded-xl text-[10px] font-black uppercase">STAFF</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-5">
              {authMode !== "login" && (
                <div className="space-y-5">
                  {authMode === "join_staff" && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">5-Digit Store ID</Label>
                      <Input 
                        placeholder="e.g. 54321" 
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

                  {authMode === "register_owner" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Name</Label>
                        <Input 
                          placeholder="e.g. JMJ Foods" 
                          className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Address</Label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder=" Makati City" 
                            className="h-14 pl-10 rounded-2xl border-none bg-gray-100 font-bold"
                            value={storeAddress}
                            onChange={(e) => setStoreAddress(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </>
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

              {authMode !== "login" && !currentUser && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Confirm Password</Label>
                  <Input 
                    type="password" 
                    placeholder="Repeat Password" 
                    className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <Button 
                type="submit"
                className="w-full h-16 rounded-[24px] bg-primary text-white font-black text-sm shadow-xl active:scale-[0.98] transition-all mt-6" 
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {authMode === "login" ? "OPEN TERMINAL" : authMode === "register_owner" ? "REGISTER BUSINESS" : "JOIN AS STAFF"}
                  </>
                )}
              </Button>
            </form>
          </Tabs>
        </div>
      </div>
    </div>
  )
}