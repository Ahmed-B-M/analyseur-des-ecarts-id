
'use client';

import { collection, addDoc, Firestore, DocumentReference, updateDoc, writeBatch, doc, setDoc } from 'firebase/firestore';
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
    if (!comments || comments.length === 0) return;

    // This function is now designed to handle one or more comments,
    // but the UI calls it with one. This is more robust.
    for (const comment of comments) {
        if (comment && typeof comment.id === 'string' && comment.id.trim() !== '') {
            // Sanitize the ID more aggressively to only allow valid characters.
            const sanitizedId = comment.id.replace(/[^a-zA-Z0-9-]/g, '_');

            if (sanitizedId.length > 0) {
                const docRef = doc(firestore, 'commentCategories', sanitizedId);
                const dataToSave = {
                    id: sanitizedId,
                    date: comment.date,
                    livreur: comment.livreur,
                    ville: comment.ville,
                    note: comment.note,
                    comment: comment.comment,
                    category: comment.category,
                    entrepot: comment.entrepot, // Make sure entrepot is saved
                };

                try {
                    // Use setDoc for a single, direct write operation.
                    await setDoc(docRef, dataToSave);
                } catch (serverError: any) {
                    console.error("Save failed for comment:", comment, "Error:", serverError);
                    const permissionError = new FirestorePermissionError({
                        path: docRef.path,
                        operation: 'write',
                        requestResourceData: dataToSave,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    // We throw to let the calling component know something went wrong.
                    throw serverError;
                }
            } else {
              console.warn("Skipping comment with an ID that became empty after sanitization:", comment);
            }
        } else {
            console.warn("Skipping comment with invalid or missing ID:", comment);
        }
    }
}


export async function updateCategorizedComment(
    firestore: Firestore,
    commentId: string,
    category: string
) {
    // Ensure the ID is sanitized in the same way it was when created.
    const sanitizedId = commentId.replace(/[^a-zA-Z0-9-]/g, '_');

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

    