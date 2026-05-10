import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional().nullable(),
  price: z.coerce.number().min(0, "Price must be at least 0"),
  costPrice: z.coerce.number().min(0, "Cost must be at least 0").default(0),
  unit: z.string().default("kg"),
  stock: z.coerce.number().default(0),
  minStock: z.coerce.number().default(10),
  wholesalePrice: z.coerce.number().min(0).nullable().optional(),
  wholesaleMinQty: z.coerce.number().min(0).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  tenantId: z.string(),
  isActive: z.boolean().default(true),
});

export const ExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().min(0),
  category: z.string().default("Miscellaneous"),
  notes: z.string().optional().nullable(),
  tenantId: z.string(),
  expenseDate: z.string(), // ISO string
});

export const ClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  type: z.enum(["Regular", "Wholesale", "Staff", "Other"]).default("Regular"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  outstandingBalance: z.coerce.number().default(0),
  oldestUnpaidAt: z.any().nullable().optional(), // Firestore Timestamp
  tenantId: z.string(),
});

export const TransactionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  unit: z.string().optional(),
  costPrice: z.number().optional(),
  isWholesale: z.boolean().optional(),
});

export const TransactionSchema = z.object({
  tenantId: z.string(),
  clientId: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  totalAmount: z.number(),
  totalCost: z.number().optional(),
  type: z.enum(["Sale", "ManualCredit", "Adjustment"]),
  paymentType: z.enum(["cash", "card", "credit"]).optional(),
  items: z.array(TransactionItemSchema).default([]),
  notes: z.string().optional().nullable(),
  dueDate: z.string().nullable().optional(), // ISO string
});
