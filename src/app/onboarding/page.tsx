"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Store, ArrowRight, Calendar as CalendarIcon, MapPin } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useUser, useFirestore } from "@/firebase"

export default function OnboardingPage() {
  const [storeName, setStoreName] = useState("")
  const [storeAddress, setStoreAddress] = useState("")
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setStartDate(new Date())
  }, [])

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/auth")
    }
  }, [user, isUserLoading, router])

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !db || !storeName.trim() || !storeAddress.trim()) return

    setLoading(true)
    try {
      const tenantId = Math.floor(10000 + Math.random() * 90000).toString()
      const normalizedEmail = user.email?.toLowerCase() || ""
      
      await setDoc(doc(db, "tenants", tenantId), {
        id: tenantId,
        name: storeName,
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

      await setDoc(doc(db, "userProfiles", user.uid), {
        id: user.uid,
        email: normalizedEmail,
        role: "owner",
        tenantId: tenantId,
        displayName: user.displayName || storeName + " Owner",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      toast({
        title: "Store Created!",
        description: `Welcome to FreshTally. Your Store Code is ${tenantId}.`
      })
      router.push("/")
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (isUserLoading || !user || !startDate) return null

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-[40px] overflow-hidden">
        <CardHeader className="text-center pt-10 pb-6 bg-accent text-white relative">
          <div className="h-20 w-20 bg-white/20 rounded-[24px] flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <Store className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-tighter">Your Store Profile</CardTitle>
          <p className="text-white/80 text-xs font-bold uppercase tracking-widest mt-2">Initialize your SaaS workspace</p>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <form onSubmit={handleOnboarding} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="storeName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Store Name</Label>
              <Input 
                id="storeName"
                name="storeName"
                placeholder="e.g. Metro Roast Coffee" 
                className="h-16 rounded-2xl border-none bg-gray-100 font-bold text-lg"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeAddress" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Store Address</Label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  id="storeAddress"
                  name="storeAddress"
                  placeholder=" Makati Ave, Makati City" 
                  className="h-16 pl-12 rounded-2xl border-none bg-gray-100 font-bold text-lg"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Operations Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="startDate"
                    name="startDate"
                    variant={"outline"}
                    className={cn(
                      "w-full h-16 justify-start text-left font-bold rounded-2xl bg-gray-100 border-none",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-5 w-5 text-accent" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-[32px] overflow-hidden" align="center">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Currency Default</p>
              <p className="text-sm font-bold text-blue-800">Philippine Peso (PHP ₱)</p>
            </div>

            <Button type="submit" className="w-full h-16 rounded-[24px] bg-accent text-white font-black text-xl shadow-xl active:scale-[0.98] transition-all" disabled={loading}>
              {loading ? "INITIALIZING..." : "LAUNCH STORE"}
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
