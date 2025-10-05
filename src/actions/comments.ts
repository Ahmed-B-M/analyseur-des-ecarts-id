'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { collection, addDoc } from 'firebase/firestore';
import { getSdks } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const CategorizeCommentInputSchema = z.object({
  comment: z.string().describe('The customer comment to categorize.'),
});

const CategorizeCommentOutputSchema = z.object({
  category: z
    .enum(['Retard', 'Avance', 'Rupture chaine de froid', 'Attitude Livreur','Casse','Manquant', 'Autre'])
    .describe(
      "The category of the comment. Must be one of: 'Retard', 'Avance', 'Rupture chaine de froid', 'Attitude Livreur','Casse','Manquant', 'Autre'."
    ),
});

const categorizeCommentFlow = ai.defineFlow(
  {
    name: 'categorizeCommentFlow',
    inputSchema: CategorizeCommentInputSchema,
    outputSchema: CategorizeCommentOutputSchema,
  },
  async (input) => {
    const prompt = `Categorize the following customer comment into one of these categories: 'Retard', 'Avance', 'Rupture chaine de froid', 'Attitude Livreur','Casse','Manquant', 'Autre'. Comment: "${input.comment}"`;
    
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


export async function saveCommentAction(commentData: {
  id: string;
  date: string;
  livreur: string;
  entrepot: string;
  nomTournee: string;
  sequence: number | undefined;
  comment: string;
  category: string;
  action: string;
}) {
  const { firestore } = getSdks();
  const collectionRef = collection(firestore, 'suiviCommentaires');

  const dataToSave = {
    date: commentData.date,
    livreur: commentData.livreur,
    entrepot: commentData.entrepot,
    nomTournee: commentData.nomTournee,
    sequence: commentData.sequence,
    commentaire: commentData.comment,
    categorie: commentData.category,
    actionCorrective: commentData.action,
    statut: 'À traiter',
    traiteLe: new Date().toISOString(),
  };

  addDoc(collectionRef, dataToSave).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: collectionRef.path,
      operation: 'create',
      requestResourceData: dataToSave,
    });
    errorEmitter.emit('permission-error', permissionError);
    // The error will be caught by the global FirebaseErrorListener
  });
}
    