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
    let retryTimeout: NodeJS.Timeout | null = null;
    let settlingTimeout: NodeJS.Timeout | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Cleanup previous listeners and timeouts
      if (retryTimeout) clearTimeout(retryTimeout);
      if (settlingTimeout) clearTimeout(settlingTimeout);
      if (unsubProfile) unsubProfile();
      if (unsubTenant) unsubTenant();
      unsubProfile = null;
      unsubTenant = null;

      if (!user) {
        setAuthState({
          user: null,
          profile: null,
          tenant: null,
          isUserLoading: false,
          userError: null,
        });
        return;
      }

      setAuthState(s => ({ ...s, user, isUserLoading: true }));

      const setupSync = () => {
        const profileRef = doc(firestore, 'userProfiles', user.uid);
        
        unsubProfile = onSnapshot(profileRef, (profileSnap) => {
          if (!profileSnap.exists()) {
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(setupSync, 2000);
            return;
          }

          const profileData = profileSnap.data() as UserProfile;
          
          if (profileData.tenantId) {
            const tenantRef = doc(firestore, 'tenants', profileData.tenantId);
            
            if (unsubTenant) unsubTenant();
            unsubTenant = onSnapshot(tenantRef, (tenantSnap) => {
              if (tenantSnap.exists()) {
                // Introduce a small settling period (800ms) to allow Security Rules 
                // propagation to stabilize before releasing the UI to perform queries.
                if (settlingTimeout) clearTimeout(settlingTimeout);
                settlingTimeout = setTimeout(() => {
                  setAuthState({
                    user,
                    profile: profileData,
                    tenant: tenantSnap.data() as TenantData,
                    isUserLoading: false,
                    userError: null
                  });
                }, 800);
              } else {
                if (retryTimeout) clearTimeout(retryTimeout);
                retryTimeout = setTimeout(setupSync, 2000);
              }
            }, (err) => {
              if (err.code === 'permission-denied') {
                if (retryTimeout) clearTimeout(retryTimeout);
                retryTimeout = setTimeout(setupSync, 2000);
                return;
              }
              setAuthState(s => ({ ...s, isUserLoading: false, userError: err }));
            });
          } else {
            // Super Admin or Onboarding needed
            setAuthState({
              user,
              profile: profileData,
              tenant: null,
              isUserLoading: false,
              userError: null
            });
          }
        }, (err) => {
          if (err.code === 'permission-denied') {
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(setupSync, 2000);
            return;
          }
          setAuthState(s => ({ ...s, isUserLoading: false, userError: err }));
        });
      };

      setupSync();
    }, (error) => {
      setAuthState(s => ({ ...s, userError: error, isUserLoading: false }));
    });

    return () => {
      unsubscribeAuth();
      if (retryTimeout) clearTimeout(retryTimeout);
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