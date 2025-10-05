
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
    
    comments.forEach(comment => {
        if (comment && typeof comment.id === 'string' && comment.id.trim() !== '') {
            // Firestore document IDs must not be empty and must not contain slashes or other reserved characters.
            // A simple and safe approach is to remove problematic characters.
            const sanitizedId = comment.id.replace(/[\/\\*\[\]]/g, '');

            if (sanitizedId.length > 0) {
              const docRef = doc(firestore, 'commentCategories', sanitizedId);
              batch.set(docRef, { ...comment, id: sanitizedId });
            } else {
              console.warn("Skipping comment with an ID that became empty after sanitization:", comment);
            }
        } else {
            console.warn("Skipping comment with invalid or missing ID:", comment);
        }
    });

    try {
        await batch.commit();
    } catch(serverError: any) {
        // Since we cannot reliably determine which specific document failed in a batch write,
        // we will log a more generic error. The developer can inspect the `comments` array.
        console.error("Batch save failed. Data that was being written:", comments);
        const permissionError = new FirestorePermissionError({
          path: 'commentCategories', // Path of the collection
          operation: 'write',
          // Note: requestResourceData should ideally be the specific failing doc, 
          // but we don't know which one it is. We log the whole batch above.
          requestResourceData: { info: "Batch write to 'commentCategories' failed." },
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
    // Sanitize the ID in the same way as when creating it
    const sanitizedId = commentId.replace(/[\/\\*\[\]]/g, '');
    if (sanitizedId.length === 0) {
      console.error("Cannot update comment with an ID that is empty after sanitization:", commentId);
      return;
    }
    const docRef = doc(firestore, 'commentCategories', sanitizedId);
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
