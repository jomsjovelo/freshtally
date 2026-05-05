
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect, useCallback } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot, collection, query, limit, getDocs, getDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface UserProfile {
  uid: string;
  role: 'super_admin' | 'owner' | 'staff';
  tenantId?: string;
  email: string;
  name?: string;
}

interface TenantData {
  id: string;
  status: 'active' | 'suspended';
  subscriptionPlan: string;
  expiryDate: string;
  name: string;
  logoUrl?: string;
  ownerEmail?: string;
  currency?: string;
}

interface UserAuthState {
  user: User | null;
  profile: UserProfile | null;
  tenant: TenantData | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState extends UserAuthState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<{
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}> = ({ children, firebaseApp, firestore, auth, storage }) => {
  const [authState, setAuthState] = useState<UserAuthState>({
    user: null,
    profile: null,
    tenant: null,
    isUserLoading: true,
    userError: null,
  });

  const syncEnvironment = useCallback((user: User) => {
    let unsubProfile: (() => void) | null = null;
    let unsubTenant: (() => void) | null = null;
    let settlingTimeout: NodeJS.Timeout | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (settlingTimeout) clearTimeout(settlingTimeout);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (unsubProfile) unsubProfile();
      if (unsubTenant) unsubTenant();
    };

    const verifyAccessAndFinalize = async (profileData: UserProfile, tenantData: TenantData) => {
      // ACTIVE STABILIZATION AUDIT: V8
      // Instead of a fixed delay, we perform a silent test query.
      // If this fails, the rules engine is NOT ready yet.
      const testAccess = async () => {
        try {
          const tId = tenantData.id;
          // Test 1: Parent Doc
          const tDoc = await getDoc(doc(firestore, 'tenants', tId));
          if (!tDoc.exists()) return false;
          
          // Test 2: Subcollection (The most sensitive propagation point)
          const txQuery = query(collection(firestore, 'tenants', tId, 'transactions'), limit(1));
          await getDocs(txQuery);
          
          return true;
        } catch (e) {
          return false;
        }
      };

      let attempts = 0;
      const maxAttempts = 5;
      
      const poll = async () => {
        const isReady = await testAccess();
        if (isReady || attempts >= maxAttempts) {
          setAuthState({
            user,
            profile: profileData,
            tenant: tenantData,
            isUserLoading: false,
            userError: null
          });
        } else {
          attempts++;
          retryTimeout = setTimeout(poll, 2000);
        }
      };

      poll();
    };

    const attemptSync = () => {
      const profileRef = doc(firestore, 'userProfiles', user.uid);
      
      unsubProfile = onSnapshot(profileRef, (profileSnap) => {
        if (!profileSnap.exists()) return;
        if (profileSnap.metadata.hasPendingWrites) return;

        const profileData = profileSnap.data() as UserProfile;
        
        if (profileData.role === 'super_admin') {
          setAuthState({ user, profile: profileData, tenant: null, isUserLoading: false, userError: null });
          return;
        }

        if (profileData.tenantId) {
          const tenantRef = doc(firestore, 'tenants', profileData.tenantId);
          
          if (unsubTenant) unsubTenant();
          unsubTenant = onSnapshot(tenantRef, (tenantSnap) => {
            if (!tenantSnap.exists()) return;
            if (tenantSnap.metadata.hasPendingWrites) return;

            const tenantData = tenantSnap.data() as TenantData;
            verifyAccessAndFinalize(profileData, tenantData);
          }, (err) => {
            if (err.code === 'permission-denied') {
              if (retryTimeout) clearTimeout(retryTimeout);
              retryTimeout = setTimeout(attemptSync, 2000);
            } else {
              setAuthState(s => ({ ...s, isUserLoading: false, userError: err }));
            }
          });
        }
      }, (err) => {
        if (err.code === 'permission-denied') {
          if (retryTimeout) clearTimeout(retryTimeout);
          retryTimeout = setTimeout(attemptSync, 2000);
        } else {
          setAuthState(s => ({ ...s, isUserLoading: false, userError: err }));
        }
      });
    };

    attemptSync();
    return cleanup;
  }, [firestore]);

  useEffect(() => {
    if (!auth || !firestore) return;

    let syncCleanup: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (syncCleanup) syncCleanup();
      
      if (!user) {
        setAuthState({ user: null, profile: null, tenant: null, isUserLoading: false, userError: null });
        return;
      }

      setAuthState(s => ({ ...s, user, isUserLoading: true }));
      syncCleanup = syncEnvironment(user);
    }, (error) => {
      setAuthState(s => ({ ...s, userError: error, isUserLoading: false }));
    });

    return () => {
      unsubscribeAuth();
      if (syncCleanup) syncCleanup();
    };
  }, [auth, firestore, syncEnvironment]);

  const contextValue = useMemo(() => ({
    ...authState,
    areServicesAvailable: !!(firebaseApp && firestore && auth && storage),
    firebaseApp,
    firestore,
    auth,
    storage,
  }), [firebaseApp, firestore, auth, storage, authState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirebase must be used within FirebaseProvider');
  return context;
};

export const useUser = () => {
  const { user, profile, tenant, isUserLoading, userError } = useFirebase();
  return { user, profile, tenant, isUserLoading, userError };
};

export const useFirestore = () => useFirebase().firestore!;
export const useAuth = () => useFirebase().auth!;
export const useStorage = () => useFirebase().storage!;

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T & { __memo?: boolean } {
  const memoized = useMemo(factory, deps);
  if (typeof memoized === 'object' && memoized !== null) {
    (memoized as any).__memo = true;
  }
  return memoized as any;
}
