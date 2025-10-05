
'use client';

import { collection, addDoc, Firestore, DocumentReference, updateDoc, writeBatch, doc } from 'firebase/firestore';
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

export async function updateSuiviCommentaire(
  docRef: DocumentReference,
  dataToUpdate: Partial<{ categorie: string; actionCorrective: string; statut: string }>
) {
  try {
    await updateDoc(docRef, dataToUpdate);
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: dataToUpdate,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
}

export async function batchSaveCategorizedComments(
    firestore: Firestore,
    comments: any[],
) {
    const batch = writeBatch(firestore);
    const collectionRef = collection(firestore, 'commentCategories');

    comments.forEach(comment => {
        const docRef = doc(firestore, 'commentCategories', comment.id);
        batch.set(docRef, comment);
    });

    try {
        await batch.commit();
    } catch(serverError) {
        const permissionError = new FirestorePermissionError({
          path: collectionRef.path,
          operation: 'write',
          requestResourceData: comments,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function updateCategorizedComment(
    firestore: Firestore,
    commentId: string,
    category: string
) {
    const docRef = doc(firestore, 'commentCategories', commentId);
    try {
        await updateDoc(docRef, { category });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: { category },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}
