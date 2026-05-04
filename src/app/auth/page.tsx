
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "firebase/auth"
import { doc, setDoc, getDoc, getFirestore } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ShieldCheck, LogIn, UserPlus } from "lucide-react"

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const auth = getAuth()
  const db = getFirestore()

  const handleGenesisAdmin = async (user: any) => {
    const adminEmail = "jomsjovelo26@gmail.com"
    if (user.email === adminEmail) {
      const profileRef = doc(db, "userProfiles", user.uid)
      await setDoc(profileRef, {
        uid: user.uid,
        email: user.email,
        role: "super_admin",
        tenantId: "SYSTEM_GLOBAL",
        name: user.displayName || "Platform Admin",
        createdAt: new Date().toISOString()
      }, { merge: true })
      return true
    }
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password)
        router.push("/")
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        const isAdmin = await handleGenesisAdmin(user)
        if (isAdmin) {
          router.push("/super-admin")
        } else {
          router.push("/onboarding")
        }
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

  const handleGoogleSignIn = async () => {
    setLoading(true)
    const provider = new GoogleAuthProvider()
    try {
      const { user } = await signInWithPopup(auth, provider)
      const profileRef = doc(db, "userProfiles", user.uid)
      const profileSnap = await getDoc(profileRef)
      
      const isAdmin = await handleGenesisAdmin(user)
      if (isAdmin) {
        router.push("/super-admin")
        return
      }

      if (profileSnap.exists()) {
        router.push("/")
      } else {
        router.push("/onboarding")
      }
    } catch (error: any) {
      toast({
        title: "Google Sign-In Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <Card className="w-full max-w-sm border-none shadow-2xl rounded-[32px] overflow-hidden">
        <CardHeader className="text-center pt-8 bg-primary text-white">
          <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-tighter">
            {isLogin ? "Welcome Back" : "FreshTally Registration"}
          </CardTitle>
          <p className="text-white/70 text-sm font-medium">Fast. Secure. Business Smart.</p>
        </CardHeader>
        <CardContent className="pt-8 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Work Email</Label>
              <Input 
                type="email" 
                placeholder="name@store.com" 
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
            <Button className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20" disabled={loading}>
              {loading ? "Processing..." : isLogin ? "LOGIN ACCESS" : "REGISTER STORE"}
              {isLogin ? <LogIn className="ml-2 h-5 w-5" /> : <UserPlus className="ml-2 h-5 w-5" />}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-white px-2 text-muted-foreground">OR CONNECT VIA</span></div>
          </div>

          <Button 
            variant="outline" 
            className="w-full h-14 rounded-2xl border-none bg-gray-100 font-bold text-gray-700"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>
        </CardContent>
        <CardFooter className="justify-center pb-8">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-black uppercase text-primary tracking-widest hover:underline"
          >
            {isLogin ? "Need a new store? Register" : "Already have a shop? Login"}
          </button>
        </CardFooter>
      </Card>
    </div>
  )
}
