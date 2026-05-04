'use server';
/**
 * @fileOverview An AI agent for automatically categorizing business expenses.
 *
 * - autoCategorizeExpense - A function that handles the expense categorization process.
 * - AutoCategorizeExpenseInput - The input type for the autoCategorizeExpense function.
 * - AutoCategorizeExpenseOutput - The return type for the autoCategorizeExpense function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutoCategorizeExpenseInputSchema = z.object({
  expenseDetails: z
    .string()
    .describe('The description or details of the expense to be categorized.'),
});
export type AutoCategorizeExpenseInput = z.infer<
  typeof AutoCategorizeExpenseInputSchema
>;

const AutoCategorizeExpenseOutputSchema = z.object({
  category: z
    .string()
    .describe(
      'The primary category for the expense (e.g., Office Supplies, Utilities, Marketing, Travel, Meals, Rent, Software, Salary, Inventory, Shipping, Miscellaneous, Vehicle Expenses, Professional Fees, Insurance, Maintenance & Repairs).'
    ),
  explanation: z
    .string()
    .describe('A brief explanation for why the expense was assigned to this category.'),
});
export type AutoCategorizeExpenseOutput = z.infer<
  typeof AutoCategorizeExpenseOutputSchema
>;

export async function autoCategorizeExpense(
  input: AutoCategorizeExpenseInput
): Promise<AutoCategorizeExpenseOutput> {
  return autoCategorizeExpenseFlow(input);
}

const autoCategorizeExpensePrompt = ai.definePrompt({
  name: 'autoCategorizeExpensePrompt',
  input: {schema: AutoCategorizeExpenseInputSchema},
  output: {schema: AutoCategorizeExpenseOutputSchema},
  prompt: `You are an AI assistant specialized in categorizing business expenses.
Your task is to analyze the provided expense details and assign it to the most appropriate business category. Provide a brief explanation for your categorization.

Available categories include:
- Office Supplies
- Utilities
- Marketing
- Travel
- Meals
- Rent
- Software
- Salary
- Inventory
- Shipping
- Miscellaneous
- Vehicle Expenses
- Professional Fees
- Insurance
- Maintenance & Repairs

Expense Details: {{{expenseDetails}}}`,
});

const autoCategorizeExpenseFlow = ai.defineFlow(
  {
    name: 'autoCategorizeExpenseFlow',
    inputSchema: AutoCategorizeExpenseInputSchema,
    outputSchema: AutoCategorizeExpenseOutputSchema,
  },
  async (input) => {
    const {output} = await autoCategorizeExpensePrompt(input);
    return output!;
  }
);
