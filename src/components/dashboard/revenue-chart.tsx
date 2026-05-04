
"use client"

import { useMemo } from "react"
import { Line, LineChart, ResponsiveContainer, XAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, Timestamp } from "firebase/firestore"
import { format, subDays, startOfDay, endOfDay } from "date-fns"

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",
  },
}

export function RevenueChart() {
  const { tenant } = useUser()
  const db = useFirestore()

  // Fetch transactions for the last 7 days
  const sevenDaysAgo = startOfDay(subDays(new Date(), 6))
  const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo)

  const revenueQuery = useMemoFirebase(() => {
    if (!db || !tenant?.id) return null
    return query(
      collection(db, "tenants", tenant.id, "transactions"),
      where("type", "==", "Sale"),
      where("createdAt", ">=", sevenDaysAgoTimestamp),
      orderBy("createdAt", "asc")
    )
  }, [db, tenant?.id])

  const { data: transactions, isLoading } = useCollection(revenueQuery)

  const chartData = useMemo(() => {
    // Initialize last 7 days with 0 revenue
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i)
      return {
        day: format(date, "EEE"),
        fullDate: format(date, "yyyy-MM-dd"),
        revenue: 0
      }
    })

    if (!transactions) return days

    transactions.forEach(tx => {
      if (!tx.createdAt) return
      const txDate = tx.createdAt.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt)
      const dateStr = format(txDate, "yyyy-MM-dd")
      const dayData = days.find(d => d.fullDate === dateStr)
      if (dayData) {
        dayData.revenue += (tx.totalAmount || 0)
      }
    })

    return days
  }, [transactions])

  if (isLoading) {
    return (
      <div className="h-[180px] w-full flex items-center justify-center">
        <div className="text-[10px] font-black text-muted-foreground uppercase animate-pulse">Analyzing Performance...</div>
      </div>
    )
  }

  return (
    <div className="h-[180px] w-full mt-2">
      <ChartContainer config={chartConfig}>
        <LineChart data={chartData}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
          <XAxis 
            dataKey="day" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} 
            dy={10}
          />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-revenue)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: "var(--color-revenue)" }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}
