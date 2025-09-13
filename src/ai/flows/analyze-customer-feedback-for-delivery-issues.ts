// @ts-nocheck
'use server';

/**
 * @fileOverview Analyzes customer feedback to identify comments related to delivery timing issues (late or early).
 *
 * - analyzeCustomerFeedback - A function that analyzes customer feedback using Gemini to determine if it relates to delivery timing.
 * - AnalyzeCustomerFeedbackInput - The input type for the analyzeCustomerFeedback function.
 * - AnalyzeCustomerFeedbackOutput - The return type for the analyzeCustomerFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCustomerFeedbackInputSchema = z.object({
  commentaire: z
    .string()
    .describe('The customer feedback comment to be analyzed.'),
});
export type AnalyzeCustomerFeedbackInput = z.infer<typeof AnalyzeCustomerFeedbackInputSchema>;

const AnalyzeCustomerFeedbackOutputSchema = z.object({
  reason: z
    .enum(['Retard', 'Avance', 'Autre'])
    .describe("The reason for the customer's dissatisfaction. Must be 'Retard', 'Avance', or 'Autre'."),
});
export type AnalyzeCustomerFeedbackOutput = z.infer<typeof AnalyzeCustomerFeedbackOutputSchema>;

export async function analyzeCustomerFeedback(input: AnalyzeCustomerFeedbackInput): Promise<AnalyzeCustomerFeedbackOutput> {
  return analyzeCustomerFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCustomerFeedbackPrompt',
  input: {schema: AnalyzeCustomerFeedbackInputSchema},
  output: {schema: AnalyzeCustomerFeedbackOutputSchema},
  prompt: `Le commentaire client suivant est-il lié à un retard ou à une livraison en avance ? Commentaire: "{{{commentaire}}}\