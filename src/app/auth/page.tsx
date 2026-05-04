
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth"
import { doc, setDoc, getFirestore, serverTimestamp, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ShieldCheck, LogIn, Store, Users, MapPin } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  const router = useRouter()
  const { toast } = useToast()
  const auth = getAuth()
  const db = getFirestore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (authMode !== "login" && password !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email, password)
        router.push("/")
      } else if (authMode === "register_owner") {
        if (!businessName.trim()) throw new Error("Business name is required.")
        if (!ownerName.trim()) throw new Error("Owner name is required.")
        if (!storeAddress.trim()) throw new Error("Business address is required.")

        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        
        // GENESIS ADMIN CHECK - Hardcoded master account
        const adminEmail = "jomsjovelo@gmail.com"
        if (user.email === adminEmail) {
          await setDoc(doc(db, "userProfiles", user.uid), {
            uid: user.uid,
            email: user.email,
            role: "super_admin",
            tenantId: null,
            name: ownerName || "System Owner",
            createdAt: serverTimestamp()
          })
          toast({ title: "Genesis Active", description: "System Owner privileges granted." })
          router.push("/")
          return
        }

        // Generate a 5-digit unique numeric Store ID
        const tenantId = Math.floor(10000 + Math.random() * 90000).toString()

        await setDoc(doc(db, "tenants", tenantId), {
          id: tenantId,
          name: businessName,
          ownerName: ownerName,
          address: storeAddress,
          status: "active",
          subscriptionPlan: "basic",
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          ownerEmail: user.email,
          currency: "PHP",
          createdAt: serverTimestamp()
        })

        await setDoc(doc(db, "userProfiles", user.uid), {
          uid: user.uid,
          email: user.email,
          role: "owner",
          tenantId: tenantId,
          name: ownerName,
          createdAt: serverTimestamp()
        })

        toast({ title: "Store Created", description: `${businessName} is now live with ID: ${tenantId}.` })
        router.push("/")
      } else if (authMode === "join_staff") {
        if (!tenantIdInput.trim()) throw new Error("5-Digit Store ID is required to join.")
        
        // Verify tenant exists
        const tenantDoc = await getDoc(doc(db, "tenants", tenantIdInput))
        if (!tenantDoc.exists()) throw new Error("Invalid Store ID. Please check with your manager.")

        const { user } = await createUserWithEmailAndPassword(auth, email, password)

        await setDoc(doc(db, "userProfiles", user.uid), {
          uid: user.uid,
          email: user.email,
          role: "staff",
          tenantId: tenantIdInput,
          name: ownerName || "Shop Staff",
          createdAt: serverTimestamp()
        })

        toast({ title: "Welcome to the Team", description: `Successfully joined ${tenantDoc.data().name}.` })
        router.push("/")
      }
    } catch (error: any) {
      toast({
        title: "Access Denied",
        description: error.message,
        variant: "destructive"
      })
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
          <Tabs value={authMode} onValueChange={(v: any) => setAuthMode(v)} className="w-full">
            <TabsList className="grid grid-cols-3 h-14 bg-gray-100 rounded-2xl p-1 mb-8">
              <TabsTrigger value="login" className="rounded-xl text-[10px] font-black uppercase">LOGIN</TabsTrigger>
              <TabsTrigger value="register_owner" className="rounded-xl text-[10px] font-black uppercase">OWNER</TabsTrigger>
              <TabsTrigger value="join_staff" className="rounded-xl text-[10px] font-black uppercase">STAFF</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-5">
              {authMode !== "login" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
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
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      Full Legal Name
                    </Label>
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
                          placeholder="e.g. Metro Roast Coffee" 
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
                            placeholder="e.g. Makati Ave, Makati City" 
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

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Email</Label>
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
                  placeholder="••••••••" 
                  className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {authMode !== "login" && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Confirm Identity</Label>
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
                className="w-full h-16 rounded-[24px] bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-6" 
                disabled={loading}
              >
                {loading ? "AUTHENTICATING..." : authMode === "login" ? "OPEN TERMINAL" : authMode === "register_owner" ? "REGISTER BUSINESS" : "JOIN AS STAFF"}
                {authMode === "login" ? <LogIn className="ml-2 h-4 w-4" /> : authMode === "register_owner" ? <Store className="ml-2 h-4 w-4" /> : <Users className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
