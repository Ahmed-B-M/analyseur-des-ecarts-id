'use client';

import { collection, addDoc, Firestore } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export async function saveSuiviCommentaire(
  firestore: Firestore,
  commentData: {
    id: string;
    date: string;
    livreur: string;
    entrepot: string;
    nomTournee: string;
    sequence: number | undefined;
    comment: string;
    category: string;
    action: string;
  }
) {
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

  try {
    await addDoc(collectionRef, dataToSave);
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: collectionRef.path,
      operation: 'create',
      requestResourceData: dataToSave,
    });
    errorEmitter.emit('permission-error', permissionError);
    // Re-throw the original error to be caught by the calling component
    throw serverError;
  }
}
