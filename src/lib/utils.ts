
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInDays } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strictly formats currency as Philippine Peso (₱)
 */
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount)
}

export type AgingCategory = 'current' | 'overdue' | 'critical';

/**
 * AR Aging Logic: Calculates bucket based on oldest unpaid transaction
 */
export function getAgingCategory(oldestUnpaidAt: any): AgingCategory {
  if (!oldestUnpaidAt) return 'current';
  
  const date = oldestUnpaidAt.toDate ? oldestUnpaidAt.toDate() : new Date(oldestUnpaidAt);
  if (isNaN(date.getTime())) return 'current';

  const days = differenceInDays(new Date(), date);
  
  if (days >= 60) return 'critical';
  if (days >= 30) return 'overdue';
  return 'current';
}

/**
 * Visual Aging Indicators: MD3-inspired semantic colors
 */
export function getAgingColor(category: AgingCategory) {
  switch (category) {
    case 'critical': return 'text-destructive font-black'; // Red
    case 'overdue': return 'text-amber-500 font-bold';    // Warning/Yellow
    default: return 'text-muted-foreground font-medium';  // Neutral
  }
}
