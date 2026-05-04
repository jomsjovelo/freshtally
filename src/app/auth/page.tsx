"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth"
import { doc, setDoc, getFirestore, serverTimestamp } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ShieldCheck, LogIn, Store, Upload } from "lucide-react"

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [storeAddress, setStoreAddress] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const auth = getAuth()
  const db = getFirestore()
  const storage = getStorage()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isLogin && password !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password)
        router.push("/")
      } else {
        if (!businessName.trim()) {
          throw new Error("Business name is required.")
        }
        if (!storeAddress.trim()) {
          throw new Error("Store address is required.")
        }

        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        
        // Genesis Admin Logic
        const adminEmail = "jomsjovelo26@gmail.com"
        if (user.email === adminEmail) {
          await setDoc(doc(db, "userProfiles", user.uid), {
            uid: user.uid,
            email: user.email,
            role: "super_admin",
            tenantId: "SYSTEM_GLOBAL",
            name: "Platform Admin",
            createdAt: serverTimestamp()
          })
          router.push("/super-admin")
          return
        }

        // Standard Tenant Creation
        const tenantId = `tenant_${Math.random().toString(36).substr(2, 9)}`
        let logoUrl = null

        if (logoFile) {
          const logoRef = ref(storage, `tenants/${tenantId}/logo_${Date.now()}`)
          await uploadBytes(logoRef, logoFile)
          logoUrl = await getDownloadURL(logoRef)
        }

        // Create Tenant
        await setDoc(doc(db, "tenants", tenantId), {
          id: tenantId,
          name: businessName,
          address: storeAddress,
          logoUrl,
          status: "active",
          subscriptionPlan: "basic",
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          ownerEmail: user.email,
          currency: "PHP",
          createdAt: serverTimestamp()
        })

        // Create Profile
        await setDoc(doc(db, "userProfiles", user.uid), {
          uid: user.uid,
          email: user.email,
          role: "owner",
          tenantId: tenantId,
          name: businessName + " Owner",
          createdAt: serverTimestamp()
        })

        toast({
          title: "Registration Success",
          description: `Welcome to FreshTally, ${businessName} is online.`
        })
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
        <div className="text-center pt-10 pb-8 bg-primary text-white px-6 shrink-0">
          <div className="h-20 w-20 bg-white/20 rounded-[28px] flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">
            {isLogin ? "Welcome Back" : "FRESHTALLY"}
          </h1>
          <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mt-2">
            {isLogin ? "B2B SaaS Terminal V2" : "Store Registration"}
          </p>
        </div>

        <div className="p-8 space-y-5 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Name</Label>
                  <Input 
                    placeholder="e.g. Metro Roast Coffee" 
                    className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Logo (Optional)</Label>
                  <div className="relative group">
                    <Input 
                      type="file" 
                      accept="image/*"
                      className="h-14 rounded-2xl border-none bg-gray-100 font-bold opacity-0 absolute inset-0 cursor-pointer z-10"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    />
                    <div className="h-14 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center gap-2 text-muted-foreground group-hover:bg-gray-200 transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-xs font-black uppercase tracking-widest">
                        {logoFile ? logoFile.name.slice(0, 15) + '...' : 'Choose Image'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Store Address</Label>
                  <Input 
                    placeholder="123 Market St, City, Province" 
                    className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Email</Label>
              <Input 
                type="email" 
                placeholder="owner@market.com" 
                className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
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

            {!isLogin && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Confirm Password</Label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="h-14 rounded-2xl border-none bg-gray-100 font-bold"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            <Button className="w-full h-16 rounded-[24px] bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all" disabled={loading}>
              {loading ? "INITIALIZING..." : isLogin ? "LOGIN ACCESS" : "REGISTER STORE"}
              {isLogin ? <LogIn className="ml-2 h-5 w-5" /> : <Store className="ml-2 h-5 w-5" />}
            </Button>
          </form>

          <div className="text-center pt-2">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline decoration-2 underline-offset-4"
            >
              {isLogin ? "Need to start a new market? Register" : "Already registered? Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
