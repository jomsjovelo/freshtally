'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore'

/**
 * INITIALIZATION ENGINE
 * Explicitly uses firebaseConfig to prevent RPC 404 errors during metadata lookup.
 * This ensures the SDK doesn't attempt to ping App Hosting endpoints in the dev cluster.
 */
export function initializeFirebase() {
  if (typeof window === 'undefined') return { firebaseApp: null, auth: null, firestore: null };

  let firebaseApp: FirebaseApp;
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }

  const sdks = getSdks(firebaseApp);
  
  // Persistence is now managed via initializeFirestore cache settings in getSdks

  return sdks;
}

let firestoreInstance: any = null;
let authInstance: any = null;

export function getSdks(firebaseApp: FirebaseApp) {
  if (!firestoreInstance && typeof window !== 'undefined') {
    firestoreInstance = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  }

  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
    // Ensure persistence is set to LOCAL so user stays logged in after tab close
    if (typeof window !== 'undefined') {
      setPersistence(authInstance, browserLocalPersistence);
    }
  }

  return {
    firebaseApp,
    auth: authInstance,
    firestore: firestoreInstance || getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
