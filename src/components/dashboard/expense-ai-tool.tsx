"use client"

import { useState } from "react"
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react"
import { autoCategorizeExpense } from "@/ai/flows/auto-categorize-expense-flow"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

export function ExpenseAITool() {
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ category: string; explanation: string } | null>(null)
  const { toast } = useToast()

  async function handleCategorize() {
    if (!description.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter expense details first.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const res = await autoCategorizeExpense({ expenseDetails: description })
      setResult(res)
    } catch (error) {
      toast({
        title: "AI Analysis Failed",
        description: "There was an error categorizing your expense.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-accent/10 border border-accent/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 text-accent">
        <Sparkles className="h-5 w-5 fill-current" />
        <h3 className="font-bold text-sm uppercase tracking-wider">AI Expense Categorizer</h3>
      </div>
      
      {!result ? (
        <div className="space-y-3">
          <Textarea 
            id="ai-expense-description"
            name="ai-expense-description"
            placeholder="E.g. Purchased 10 packs of high-quality printing paper from Staples for $55"
            className="bg-background/80 border-none shadow-inner resize-none min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoComplete="off"
          />
          <Button 
            className="w-full bg-accent hover:bg-accent/90 text-white font-semibold"
            disabled={loading}
            onClick={handleCategorize}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Auto-Categorize"}
          </Button>
        </div>
      ) : (
        <div className="bg-background p-4 rounded-xl border border-accent/30 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-start mb-2">
            <Badge className="bg-accent text-white">{result.category}</Badge>
            <Button variant="ghost" size="sm" onClick={() => { setResult(null); setDescription(""); }} className="h-8 text-[10px] uppercase">Reset</Button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            "{result.explanation}"
          </p>
          <Button 
            variant="outline" 
            className="w-full mt-4 h-10 text-xs border-accent text-accent hover:bg-accent hover:text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Add to Expenses
          </Button>
        </div>
      )}
    </div>
  )
}
