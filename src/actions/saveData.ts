
'use server';

import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';
import type { Tournee, Tache } from '@/lib/types';

// Initialize Firebase Admin SDK
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: applicationDefault(),
  });
}

export async function saveUploadedData(tournees: Tournee[], taches: Tache[]) {
  try {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    let batch: WriteBatch = db.batch();
    let commitCount = 0;
    const MAX_OPERATIONS_PER_BATCH = 499; // Firestore limit is 500

    // Save Tournees
    for (const tournee of tournees) {
      if (!tournee.entrepot || !tournee.uniqueId) continue;
      const tourneeRef = db.collection('entrepots').doc(tournee.entrepot).collection('tournees').doc(tournee.uniqueId);
      batch.set(tourneeRef, { ...tournee, id: tournee.uniqueId }); // Use spread to avoid circular refs if any
      commitCount++;

      if (commitCount >= MAX_OPERATIONS_PER_BATCH) {
        await batch.commit();
        batch = db.batch();
        commitCount = 0;
      }
    }
    
    // Save Taches
    for (const tache of taches) {
        if (!tache.entrepot || !tache.tourneeUniqueId || !tache.sequence) continue;
        const tacheRef = db.collection('entrepots').doc(tache.entrepot)
                            .collection('tournees').doc(tache.tourneeUniqueId)
                            .collection('taches').doc(String(tache.sequence));
        batch.set(tacheRef, { ...tache });
        commitCount++;

        if (commitCount >= MAX_OPERATIONS_PER_BATCH) {
            await batch.commit();
            batch = db.batch();
            commitCount = 0;
        }
    }

    // Commit any remaining operations
    if (commitCount > 0) {
      await batch.commit();
    }
    
    return { success: true, tournees: tournees.length, taches: taches.length };
  } catch (error: any) {
    console.error("Error saving data to Firestore:", error);
    return { success: false, error: "Erreur lors de la sauvegarde des données: " + error.message };
  }
}
