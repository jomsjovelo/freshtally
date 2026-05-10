"use client"

import { useState, useMemo } from "react"
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Pie, PieChart, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, Timestamp } from "firebase/firestore"
import { format, subDays, startOfDay, endOfDay, isWithinInterval, subMonths, subYears } from "date-fns"
import { cn, formatCurrency } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowUpRight, ArrowDownRight, TrendingUp, Package, Wallet, Loader2, ArrowRight } from "lucide-react"

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",
  },
  profit: {
    label: "Profit",
    color: "hsl(var(--accent))",
  },
}

export function DashboardAnalytics() {
  const { tenant } = useUser()
  const db = useFirestore()
  const [range, setRange] = useState("7") // "7", "15", "30", "YTD"

  const timeframe = useMemo(() => {
    const now = new Date()
    let days = 7
    let startDate = startOfDay(subDays(now, 6))
    
    if (range === "15") {
      days = 15
      startDate = startOfDay(subDays(now, 14))
    } else if (range === "30") {
      days = 30
      startDate = startOfDay(subDays(now, 29))
    } else if (range === "YTD") {
      days = 365 // Simplified
      startDate = new Date(now.getFullYear(), 0, 1)
    }

    // For comparison, we need double the range
    const comparisonDays = days === 365 ? 365 : days
    const priorStartDate = startOfDay(subDays(startDate, comparisonDays))
    
    return { days, startDate, priorStartDate, comparisonDays }
  }, [range])

  const analyticsQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      where("type", "==", "Sale"),
      where("createdAt", ">=", Timestamp.fromDate(timeframe.priorStartDate)),
      orderBy("createdAt", "asc")
    )
  }, [db, tenant?.id, timeframe.priorStartDate])

  const { data: transactions, isLoading } = useCollection(analyticsQuery)

  const stats = useMemo(() => {
    if (!transactions) return null

    const currentInterval = { start: timeframe.startDate, end: new Date() }
    const priorInterval = { start: timeframe.priorStartDate, end: subDays(timeframe.startDate, 1) }

    let currentRev = 0
    let currentCost = 0
    let priorRev = 0
    let priorCost = 0
    const productMap: Record<string, { name: string, value: number, fill: string }> = {}

    transactions.forEach(tx => {
      const txDate = tx.createdAt.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt)
      const amount = tx.totalAmount || 0
      const cost = tx.totalCost || 0

      if (isWithinInterval(txDate, currentInterval)) {
        currentRev += amount
        currentCost += cost

        // Aggregate top products for current period
        tx.items?.forEach((item: any) => {
          if (!productMap[item.name]) {
            productMap[item.name] = { name: item.name, value: 0, fill: `hsl(var(--primary) / ${Math.max(0.2, 1 - Object.keys(productMap).length * 0.15)})` }
          }
          productMap[item.name].value += (item.price * item.quantity)
        })
      } else if (isWithinInterval(txDate, priorInterval)) {
        priorRev += amount
        priorCost += cost
      }
    })

    const currentProfit = currentRev - currentCost
    const priorProfit = priorRev - priorCost

    const revChange = priorRev === 0 ? 100 : ((currentRev - priorRev) / priorRev) * 100
    const profitChange = priorProfit === 0 ? 100 : ((currentProfit - priorProfit) / priorProfit) * 100

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // Prepare trend data
    const daysArr = Array.from({ length: timeframe.days }, (_, i) => {
      const d = subDays(new Date(), timeframe.days - 1 - i)
      return {
        date: format(d, timeframe.days > 30 ? "MMM dd" : "EEE"),
        fullDate: format(d, "yyyy-MM-dd"),
        revenue: 0,
        profit: 0
      }
    })

    transactions.forEach(tx => {
      const txDate = tx.createdAt.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt)
      if (isWithinInterval(txDate, currentInterval)) {
        const dateStr = format(txDate, "yyyy-MM-dd")
        const dayData = daysArr.find(d => d.fullDate === dateStr)
        if (dayData) {
          dayData.revenue += (tx.totalAmount || 0)
          dayData.profit += ((tx.totalAmount || 0) - (tx.totalCost || 0))
        }
      }
    })

    return { currentRev, currentProfit, revChange, profitChange, topProducts, trendData: daysArr }
  }, [transactions, timeframe])

  if (isLoading) {
    return (
      <div className="bg-white rounded-[44px] p-12 shadow-soft border border-gray-100/50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Computing Analytics...</p>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-[44px] p-8 shadow-soft border border-gray-100/50 space-y-8">
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Business Health</p>
              <h2 className="text-xl font-black uppercase tracking-tighter mt-1">Growth & Trends</h2>
            </div>
            <Tabs value={range} onValueChange={setRange} className="h-10">
              <TabsList className="bg-gray-100 rounded-xl p-1 h-full">
                <TabsTrigger value="7" className="text-[8px] font-black uppercase px-3 h-full data-[state=active]:bg-white data-[state=active]:text-primary">7D</TabsTrigger>
                <TabsTrigger value="15" className="text-[8px] font-black uppercase px-3 h-full data-[state=active]:bg-white data-[state=active]:text-primary">15D</TabsTrigger>
                <TabsTrigger value="30" className="text-[8px] font-black uppercase px-3 h-full data-[state=active]:bg-white data-[state=active]:text-primary">30D</TabsTrigger>
                <TabsTrigger value="YTD" className="text-[8px] font-black uppercase px-3 h-full data-[state=active]:bg-white data-[state=active]:text-primary">YTD</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Total Revenue</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tighter">{formatCurrency(stats.currentRev)}</span>
                <div className={cn(
                  "flex items-center text-[8px] font-black px-1.5 py-0.5 rounded-md",
                  stats.revChange >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                )}>
                  {stats.revChange >= 0 ? <ArrowUpRight className="h-2 w-2 mr-0.5" /> : <ArrowDownRight className="h-2 w-2 mr-0.5" />}
                  {Math.abs(Math.round(stats.revChange))}%
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Gross Profit</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tighter text-accent">{formatCurrency(stats.currentProfit)}</span>
                <div className={cn(
                  "flex items-center text-[8px] font-black px-1.5 py-0.5 rounded-md",
                  stats.profitChange >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                )}>
                  {stats.profitChange >= 0 ? <ArrowUpRight className="h-2 w-2 mr-0.5" /> : <ArrowDownRight className="h-2 w-2 mr-0.5" />}
                  {Math.abs(Math.round(stats.profitChange))}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-[200px] w-full">
          <ChartContainer config={chartConfig}>
            <LineChart data={stats.trendData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 900, fill: "hsl(var(--muted-foreground))" }} 
                dy={10}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: "var(--color-revenue)" }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="var(--color-profit)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: "var(--color-profit)" }}
              />
            </LineChart>
          </ChartContainer>
        </div>
      </div>

      <div className="bg-white rounded-[44px] p-8 shadow-soft border border-gray-100/50">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Performance</p>
            <h2 className="text-lg font-black uppercase tracking-tighter">Top Selling Items</h2>
          </div>
        </div>

        {stats.topProducts.length > 0 ? (
          <div className="grid grid-cols-5 items-center gap-4">
            <div className="col-span-2 h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.topProducts}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="col-span-3 space-y-3">
              {stats.topProducts.map((item, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                    <span className="text-[9px] font-black uppercase tracking-tight truncate group-hover:text-primary transition-colors">{item.name}</span>
                  </div>
                  <span className="text-[9px] font-black tabular-nums opacity-40">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <Package className="h-8 w-8 text-muted-foreground opacity-20 mx-auto mb-3" />
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">No Sales Data</p>
          </div>
        )}
      </div>
    </div>
  )
}
