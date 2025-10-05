'use server';
/**
 * @fileOverview A customer feedback analysis AI agent.
 *
 * - analyzeCustomerFeedback - A function that handles the customer feedback analysis process.
 * - AnalyzeCustomerFeedbackInput - The input type for the analyzeCustomerFeedback function.
 * - AnalyzeCustomerFeedbackOutput - The return type for the analyzeCustomerFeedback function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AnalyzeCustomerFeedbackInputSchema = z.object({
  commentaire: z.string().describe('The customer comment to analyze.'),
});
export type AnalyzeCustomerFeedbackInput = z.infer<
  typeof AnalyzeCustomerFeedbackInputSchema
>;

const AnalyzeCustomerFeedbackOutputSchema = z.object({
  isRelevant: z.boolean().describe('Is the comment relevant to the delivery service?'),
  sentiment: z.enum(['positif', 'négatif', 'neutre']).describe('The sentiment of the comment.'),
  categories: z.array(z.enum(['Retard', 'Avance', 'Qualité Produit', 'Attitude Livreur', 'Autre'])).describe('The categories of the comment.'),
  suggestedResponse: z.string().describe('A suggested response to the customer.'),
});
export type AnalyzeCustomerFeedbackOutput = z.infer<
  typeof AnalyzeCustomerFeedbackOutputSchema
>;

export async function analyzeCustomerFeedback(
  input: AnalyzeCustomerFeedbackInput
): Promise<AnalyzeCustomerFeedbackOutput> {
  return analyzeCustomerFeedbackFlow(input);
}

const prompt = ai.definePrompt(
    {
        name: 'analyzeCustomerFeedbackPrompt',
        input: { schema: AnalyzeCustomerFeedbackInputSchema },
        output: { schema: AnalyzeCustomerFeedbackOutputSchema },
        prompt: `You are a customer service expert for a delivery company. Analyze the following customer feedback.

        Comment: {{{commentaire}}}

        Based on the comment, determine if it's relevant to the delivery service, its sentiment, categorize it, and suggest a polite and helpful response.
        Categories can be: Retard, Avance, Qualité Produit, Attitude Livreur, Autre.
        A comment can have multiple categories.
        If the comment is not relevant, set isRelevant to false and sentiment to neutre.
        The response should be in French.`,
    }
);


const analyzeCustomerFeedbackFlow = ai.defineFlow(
  {
    name: 'analyzeCustomerFeedbackFlow',
    inputSchema: AnalyzeCustomerFeedbackInputSchema,
    outputSchema: AnalyzeCustomerFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to analyze customer feedback');
    }
    return output;
  }
);
