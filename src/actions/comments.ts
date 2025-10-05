
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CategorizeCommentInputSchema = z.object({
  comment: z.string().describe('The customer comment to categorize.'),
});

const CategorizeCommentOutputSchema = z.object({
  category: z
    .enum(['Retard', 'Avance', 'Rupture chaine de froid', 'Attitude Livreur','Casse','Manquant', 'Erreur de préparation', 'Erreur de livraison', 'Autre'])
    .describe(
      "The category of the comment. Must be one of: 'Retard', 'Avance', 'Rupture chaine de froid', 'Attitude Livreur','Casse','Manquant', 'Erreur de préparation', 'Erreur de livraison', 'Autre'."
    ),
});

const categorizeCommentFlow = ai.defineFlow(
  {
    name: 'categorizeCommentFlow',
    inputSchema: CategorizeCommentInputSchema,
    outputSchema: CategorizeCommentOutputSchema,
  },
  async (input) => {
    const prompt = `Categorize the following customer comment into one of these categories: 'Retard', 'Avance', 'Rupture chaine de froid', 'Attitude Livreur','Casse','Manquant', 'Erreur de préparation', 'Erreur de livraison', 'Autre'. Comment: "${input.comment}"`;
    
    const { output } = await ai.generate({
      prompt: prompt,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: CategorizeCommentOutputSchema,
      }
    });

    if (!output) {
      return { category: 'Autre' };
    }
    return output;
  }
);


export async function analyzeNegativeComments(
  comments: { id: string; text: string }[]
): Promise<{ id: string; category: string }[]> {
  if (!comments || comments.length === 0) {
    return [];
  }

  const results = await Promise.all(
    comments.map(async (comment) => {
      try {
        const result = await categorizeCommentFlow({ comment: comment.text });
        return {
          id: comment.id,
          category: result.category,
        };
      } catch (error) {
        console.error(`Error analyzing comment ${comment.id}:`, error);
        return {
          id: comment.id,
          category: 'Autre', // Fallback category on error
        };
      }
    })
  );

  return results;
}
