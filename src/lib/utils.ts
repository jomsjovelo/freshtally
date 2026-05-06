
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInDays } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount)
}

export type AgingCategory = 'current' | 'overdue' | 'critical';

export function getAgingCategory(oldestUnpaidAt: string | null): AgingCategory {
  if (!oldestUnpaidAt) return 'current';
  
  const days = differenceInDays(new Date(), new Date(oldestUnpaidAt));
  
  if (days >= 60) return 'critical';
  if (days >= 30) return 'overdue';
  return 'current';
}

export function getAgingColor(category: AgingCategory) {
  switch (category) {
    case 'critical': return 'text-destructive';
    case 'overdue': return 'text-amber-500';
    default: return 'text-foreground';
  }
}
