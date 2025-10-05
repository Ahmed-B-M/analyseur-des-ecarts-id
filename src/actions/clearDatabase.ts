'use server';

import { initializeApp, getApps, App, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: applicationDefault(),
  });
}

async function deleteCollection(db: FirebaseFirestore.Firestore, collectionPath: string, batchSize: number) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db: FirebaseFirestore.Firestore, query: FirebaseFirestore.Query, resolve: (value: unknown) => void) {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    return resolve(0);
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}


export async function clearDatabase() {
    try {
        const adminApp = getAdminApp();
        const db = getFirestore(adminApp);

        // Delete all documents in the 'suiviCommentaires' collection
        await deleteCollection(db, 'suiviCommentaires', 50);

        // Recursively delete all documents and subcollections in 'entrepots'
        const entrepots = await db.collection('entrepots').get();
        for (const entrepot of entrepots.docs) {
             await db.recursiveDelete(entrepot.ref);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error clearing database:", error);
        return { success: false, error: "Erreur lors de la suppression des données : " + error.message };
    }
}
