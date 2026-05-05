'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
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

  useEffect(() => {
    if (!auth || !firestore) return;

    let unsubProfile: (() => void) | null = null;
    let unsubTenant: (() => void) | null = null;
    let settlingTimeout: NodeJS.Timeout | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Immediate cleanup
      if (settlingTimeout) clearTimeout(settlingTimeout);
      if (unsubProfile) unsubProfile();
      if (unsubTenant) unsubTenant();
      unsubProfile = null;
      unsubTenant = null;

      if (!user) {
        setAuthState({ user: null, profile: null, tenant: null, isUserLoading: false, userError: null });
        return;
      }

      setAuthState(s => ({ ...s, user, isUserLoading: true }));

      // Synchronized initialization sequence
      const syncEnvironment = () => {
        const profileRef = doc(firestore, 'userProfiles', user.uid);
        
        // 1. Listen to Profile
        unsubProfile = onSnapshot(profileRef, (profileSnap) => {
          if (!profileSnap.exists()) return; // Wait for document creation

          // CRITICAL: Ensure document is synced to server before releasing UI
          // This avoids querying subcollections before Rules propagation is ready.
          if (profileSnap.metadata.hasPendingWrites) return;

          const profileData = profileSnap.data() as UserProfile;
          
          if (profileData.role === 'super_admin') {
            if (settlingTimeout) clearTimeout(settlingTimeout);
            settlingTimeout = setTimeout(() => {
              setAuthState({ user, profile: profileData, tenant: null, isUserLoading: false, userError: null });
            }, 1000);
            return;
          }

          if (profileData.tenantId) {
            const tenantRef = doc(firestore, 'tenants', profileData.tenantId);
            
            if (unsubTenant) unsubTenant();
            unsubTenant = onSnapshot(tenantRef, (tenantSnap) => {
              if (!tenantSnap.exists()) return;
              if (tenantSnap.metadata.hasPendingWrites) return;

              // FINAL SETTLING BUFFER: V6 - Increased to 5s for absolute security rules propagation
              if (settlingTimeout) clearTimeout(settlingTimeout);
              settlingTimeout = setTimeout(() => {
                setAuthState({
                  user,
                  profile: profileData,
                  tenant: tenantSnap.data() as TenantData,
                  isUserLoading: false,
                  userError: null
                });
              }, 5000);
            }, (err) => {
              if (err.code !== 'permission-denied') {
                setAuthState(s => ({ ...s, isUserLoading: false, userError: err }));
              }
            });
          }
        }, (err) => {
          if (err.code !== 'permission-denied') {
            setAuthState(s => ({ ...s, isUserLoading: false, userError: err }));
          }
        });
      };

      syncEnvironment();
    }, (error) => {
      setAuthState(s => ({ ...s, userError: error, isUserLoading: false }));
    });

    return () => {
      unsubscribeAuth();
      if (settlingTimeout) clearTimeout(settlingTimeout);
      if (unsubProfile) unsubProfile();
      if (unsubTenant) unsubTenant();
    };
  }, [auth, firestore]);

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