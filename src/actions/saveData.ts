
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
  // This functionality is disabled as per user request.
  // The function is kept to avoid breaking imports, but it does nothing.
  console.log("Data saving to Firestore is disabled.");
  return { success: true, tournees: 0, taches: 0, message: "Sauvegarde désactivée." };
}
