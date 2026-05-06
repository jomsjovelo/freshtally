'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface UserProfile {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'staff' | 'super_admin';
  createdAt: any;
  updatedAt: any;
}

interface Tenant {
  id: string;
  name: string;
  address?: string;
  logoUrl?: string;
  status: 'active' | 'suspended';
  subscriptionPlan: string;
  currency: string;
  createdAt: any;
  updatedAt: any;
}

interface UserAuthState {
  user: User | null;
  profile: UserProfile | null;
  tenant: Tenant | null;
  isUserLoading: boolean;
  userError: Error | null;
  storeNotFound: boolean;
}

export interface FirebaseContextState extends UserAuthState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

export interface UserHookResult extends UserAuthState {}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<{
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}> = ({ children, firebaseApp, firestore, auth }) => {
  const [state, setState] = useState<UserAuthState>({
    user: null,
    profile: null,
    tenant: null,
    isUserLoading: true,
    userError: null,
    storeNotFound: false
  });

  useEffect(() => {
    if (!auth || !firestore) return;

    let profileUnsub: (() => void) | null = null;
    let tenantUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      // SYNC RESET: Clear state instantly to prevent zombie flashes
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      if (tenantUnsub) { tenantUnsub(); tenantUnsub = null; }

      if (!firebaseUser) {
        setState({ user: null, profile: null, tenant: null, isUserLoading: false, userError: null, storeNotFound: false });
        return;
      }

      // Step 1: Initialize profile listener
      const userRef = doc(firestore, 'users', firebaseUser.uid);
      profileUnsub = onSnapshot(userRef, (profileSnap) => {
        if (!profileSnap.exists()) {
          setState(prev => ({ ...prev, user: firebaseUser, isUserLoading: false, profile: null }));
          return;
        }

        const profileData = profileSnap.data() as UserProfile;

        // Step 2: Initialize tenant listener if ID exists
        if (profileData.tenantId) {
          const tenantRef = doc(firestore, 'tenants', profileData.tenantId);
          if (tenantUnsub) { tenantUnsub(); tenantUnsub = null; }
          
          tenantUnsub = onSnapshot(tenantRef, (tenantSnap) => {
            setState({
              user: firebaseUser,
              profile: profileData,
              tenant: tenantSnap.exists() ? (tenantSnap.data() as Tenant) : null,
              isUserLoading: false,
              userError: null,
              storeNotFound: !tenantSnap.exists()
            });
          }, (err) => {
            setState(prev => ({ ...prev, user: firebaseUser, profile: profileData, isUserLoading: false, userError: err }));
          });
        } else {
          // Special Case: Super Admin or new user without tenant
          setState({ user: firebaseUser, profile: profileData, tenant: null, isUserLoading: false, userError: null, storeNotFound: false });
        }
      }, (err) => {
        setState(prev => ({ ...prev, user: firebaseUser, isUserLoading: false, userError: err }));
      });
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
      if (tenantUnsub) tenantUnsub();
    };
  }, [auth, firestore]);

  const contextValue = useMemo((): FirebaseContextState => ({
    areServicesAvailable: !!(firebaseApp && firestore && auth),
    firebaseApp,
    firestore,
    auth,
    ...state
  }), [firebaseApp, firestore, auth, state]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase must be used within a FirebaseProvider.');
  return context;
};

export const useAuth = () => useFirebase().auth!;
export const useFirestore = () => useFirebase().firestore!;
export const useFirebaseApp = () => useFirebase().firebaseApp!;
export const useUser = (): UserHookResult => useFirebase();

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T & {__memo?: boolean} {
  const memoized = useMemo(factory, deps);
  if(typeof memoized !== 'object' || memoized === null) return memoized as any;
  (memoized as any).__memo = true;
  return memoized as any;
}
