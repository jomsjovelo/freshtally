
"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const data = [
  { day: "Mon", revenue: 4000 },
  { day: "Tue", revenue: 3000 },
  { day: "Wed", revenue: 5000 },
  { day: "Thu", revenue: 2780 },
  { day: "Fri", revenue: 6890 },
  { day: "Sat", revenue: 8390 },
  { day: "Sun", revenue: 7490 },
]

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",
  },
}

export function RevenueChart() {
  return (
    <div className="h-[180px] w-full mt-2">
      <ChartContainer config={chartConfig}>
        <LineChart data={data}>
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
