'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CATEGORIES = [
  'Attitude livreur',
  'Produit manquant',
  'Casse Produit',
  'Rupture chaine de froid',
  'Retard',
  'Avance',
  'Autre',
] as const;

const analyzeCustomerFeedbackSignature = z.object({
  commentaire: z.string(),
});
export type AnalyzeCustomerFeedbackInput = z.infer<typeof analyzeCustomerFeedbackSignature>;

const analyzeCustomerFeedbackFlowOutput = z.object({
  reason: z.enum(CATEGORIES),
});
export type AnalyzeCustomerFeedbackOutput = z.infer<typeof analyzeCustomerFeedbackFlowOutput>;


export async function analyzeCustomerFeedback(input: AnalyzeCustomerFeedbackInput): Promise<AnalyzeCustomerFeedbackOutput> {
    return await analyzeCustomerFeedbackFlow(input);
}


const analyzeCustomerFeedbackFlow = ai.defineFlow(
  {
    name: 'analyzeCustomerFeedbackFlow',
    inputSchema: analyzeCustomerFeedbackSignature,
    outputSchema: analyzeCustomerFeedbackFlowOutput,
  },
  async ({ commentaire }): Promise<AnalyzeCustomerFeedbackOutput> => {
    const prompt = `
      Analyse le commentaire client suivant et classifie-le dans l'une des catégories suivantes : ${CATEGORIES.join(', ')}.
      Ne réponds que par la catégorie.
      Si aucune catégorie ne correspond, réponds "Autre".

      Commentaire: "${commentaire}"
    `;

    const { output } = await ai.generate({
      prompt: prompt,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: analyzeCustomerFeedbackFlowOutput,
      },
      config: {
        temperature: 0.1,
      },
    });

    return output || { reason: 'Autre' };
  }
);
