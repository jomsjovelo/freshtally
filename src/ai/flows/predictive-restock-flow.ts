
'use server';
/**
 * @fileOverview An AI agent for predicting inventory restocking needs.
 *
 * - predictRestock - Analyzes historical sales and current levels to suggest reorders.
 * - PredictRestockInput - Input schema.
 * - PredictRestockOutput - Output schema.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictRestockInputSchema = z.object({
  productName: z.string().describe('Name of the product.'),
  currentStock: z.number().describe('Current quantity on hand.'),
  minStock: z.number().describe('Target minimum stock level.'),
  salesVelocity: z.array(z.number()).describe('Sales quantities over the last 7 days.'),
});
export type PredictRestockInput = z.infer<typeof PredictRestockInputSchema>;

const PredictRestockOutputSchema = z.object({
  forecastDays: z.number().describe('Predicted days until stockout.'),
  recommendedQuantity: z.number().describe('Suggested reorder amount.'),
  reasoning: z.string().describe('AI explanation for the prediction.'),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).describe('Action urgency level.'),
});
export type PredictRestockOutput = z.infer<typeof PredictRestockOutputSchema>;

export async function predictRestock(input: PredictRestockInput): Promise<PredictRestockOutput> {
  return predictRestockFlow(input);
}

const restockPrompt = ai.definePrompt({
  name: 'predictRestockPrompt',
  input: {schema: PredictRestockInputSchema},
  output: {schema: PredictRestockOutputSchema},
  prompt: `You are an inventory optimization expert. 
Based on the following data, predict the restocking needs for "{{{productName}}}".

Current Stock: {{{currentStock}}}
Alert Level: {{{minStock}}}
7-Day Sales History: {{{salesVelocity}}}

Calculate the daily sales velocity and estimate the stockout date. 
Suggest a reorder quantity that reaches the minStock plus a 20% safety buffer.
Urgency should be "critical" if stock is already below minStock.`,
});

const predictRestockFlow = ai.defineFlow(
  {
    name: 'predictRestockFlow',
    inputSchema: PredictRestockInputSchema,
    outputSchema: PredictRestockOutputSchema,
  },
  async (input) => {
    const {output} = await restockPrompt(input);
    return output!;
  }
);
