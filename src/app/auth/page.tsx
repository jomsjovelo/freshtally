
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth"
import { doc, setDoc, getFirestore, serverTimestamp, getDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ShieldCheck, LogIn, Store, Upload, Users } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<"login" | "register_owner" | "join_staff">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [storeAddress, setStoreAddress] = useState("")
  const [tenantIdInput, setTenantIdInput] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const auth = getAuth()
  const db = getFirestore()
  const storage = getStorage()

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

        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        
        const adminEmail = "jomsjovelo@gmail.com"
        if (user.email === adminEmail) {
          await setDoc(doc(db, "userProfiles", user.uid), {
            uid: user.uid,
            email: user.email,
            role: "super_admin",
            tenantId: null,
            name: ownerName || "Platform Admin",
            createdAt: serverTimestamp()
          })
          router.push("/super-admin")
          return
        }

        const tenantId = `tenant_${Math.random().toString(36).substr(2, 9)}`
        let logoUrl = null

        if (logoFile) {
          const logoRef = ref(storage, `tenants/${tenantId}/logo_${Date.now()}`)
          await uploadBytes(logoRef, logoFile)
          logoUrl = await getDownloadURL(logoRef)
        }

        await setDoc(doc(db, "tenants", tenantId), {
          id: tenantId,
          name: businessName,
          ownerName: ownerName,
          address: storeAddress,
          logoUrl,
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

        toast({ title: "Welcome Owner", description: `${businessName} is online.` })
        router.push("/")
      } else if (authMode === "join_staff") {
        if (!tenantIdInput.trim()) throw new Error("Tenant ID is required.")
        
        // Verify tenant exists
        const tenantDoc = await getDoc(doc(db, "tenants", tenantIdInput))
        if (!tenantDoc.exists()) throw new Error("Invalid Store ID. Please check with your manager.")

        const { user } = await createUserWithEmailAndPassword(auth, email, password)

        await setDoc(doc(db, "userProfiles", user.uid), {
          uid: user.uid,
          email: user.email,
          role: "staff",
          tenantId: tenantIdInput,
          name: ownerName || "Staff Member",
          createdAt: serverTimestamp()
        })

        toast({ title: "Welcome Staff", description: `Joined ${tenantDoc.data().name}.` })
        router.push("/")
      }
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <div className="w-full max-sm bg-white rounded-[40px] shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        <div className="text-center pt-10 pb-6 bg-primary text-white px-6 shrink-0">
          <div className="h-16 w-16 bg-white/20 rounded-[20px] flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">
            {authMode === "login" ? "Access Terminal" : "FreshTally Registration"}
          </h1>
          <p className="text-white/70 text-[9px] font-black uppercase tracking-widest mt-2">
            Professional B2B SaaS Platform
          </p>
        </div>

        <div className="p-8 pt-4 space-y-6 overflow-y-auto">
          <Tabs value={authMode} onValueChange={(v: any) => setAuthMode(v)} className="w-full">
            <TabsList className="grid grid-cols-3 h-12 bg-gray-100 rounded-xl p-1 mb-6">
              <TabsTrigger value="login" className="rounded-lg text-[9px] font-black uppercase">Login</TabsTrigger>
              <TabsTrigger value="register_owner" className="rounded-lg text-[9px] font-black uppercase">Owner</TabsTrigger>
              <TabsTrigger value="join_staff" className="rounded-lg text-[9px] font-black uppercase">Staff</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode !== "login" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  {authMode === "join_staff" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Store ID (Provided by Manager)</Label>
                      <Input 
                        placeholder="e.g. tenant_abc123" 
                        className="h-12 rounded-xl border-none bg-gray-100 font-bold"
                        value={tenantIdInput}
                        onChange={(e) => setTenantIdInput(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      {authMode === "register_owner" ? "Owner Full Name" : "Your Full Name"}
                    </Label>
                    <Input 
                      placeholder="e.g. Juan Dela Cruz" 
                      className="h-12 rounded-xl border-none bg-gray-100 font-bold"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required
                    />
                  </div>

                  {authMode === "register_owner" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Name</Label>
                        <Input 
                          placeholder="e.g. Metro Roast Coffee" 
                          className="h-12 rounded-xl border-none bg-gray-100 font-bold"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Store Address</Label>
                        <Input 
                          placeholder="123 Market St, City, Province" 
                          className="h-12 rounded-xl border-none bg-gray-100 font-bold"
                          value={storeAddress}
                          onChange={(e) => setStoreAddress(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Email</Label>
                <Input 
                  type="email" 
                  placeholder="name@business.com" 
                  className="h-12 rounded-xl border-none bg-gray-100 font-bold"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Password</Label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="h-12 rounded-xl border-none bg-gray-100 font-bold"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {authMode !== "login" && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Confirm Password</Label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="h-12 rounded-xl border-none bg-gray-100 font-bold"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <Button 
                className="w-full h-14 rounded-2xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-all mt-4" 
                disabled={loading}
              >
                {loading ? "PROCESSING..." : authMode === "login" ? "LOGIN ACCESS" : authMode === "register_owner" ? "REGISTER BUSINESS" : "JOIN AS STAFF"}
                {authMode === "login" ? <LogIn className="ml-2 h-4 w-4" /> : authMode === "register_owner" ? <Store className="ml-2 h-4 w-4" /> : <Users className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
