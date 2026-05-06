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
}

export interface FirebaseContextState extends UserAuthState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

export interface UserHookResult extends UserAuthState {}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * Atomic Context Synchronization: Ensures absolute loading state before UI mount.
 * Prevents race conditions during identity propagation.
 */
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
  });

  useEffect(() => {
    if (!auth || !firestore) return;

    let profileUnsub: (() => void) | null = null;
    let tenantUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      // Clear previous listeners and reset state to prevent memory leaks and zombie updates
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      if (tenantUnsub) { tenantUnsub(); tenantUnsub = null; }

      if (!firebaseUser) {
        setState({ user: null, profile: null, tenant: null, isUserLoading: false, userError: null });
        return;
      }

      // Step 1: Sync User Profile Node
      const userRef = doc(firestore, 'users', firebaseUser.uid);
      profileUnsub = onSnapshot(userRef, (profileSnap) => {
        if (!profileSnap.exists()) {
          // Profile document doesn't exist yet (propagation delay or onboarding)
          setState({ user: firebaseUser, profile: null, tenant: null, isUserLoading: false, userError: null });
          return;
        }

        const profileData = profileSnap.data() as UserProfile;

        // Step 2: Sync Business Tenant Node (Multi-tenant isolation)
        if (profileData.tenantId) {
          const tenantRef = doc(firestore, 'tenants', profileData.tenantId);
          if (tenantUnsub) { tenantUnsub(); tenantUnsub = null; }
          
          tenantUnsub = onSnapshot(tenantRef, (tenantSnap) => {
            setState({
              user: firebaseUser,
              profile: profileData,
              tenant: tenantSnap.exists() ? (tenantSnap.data() as Tenant) : null,
              isUserLoading: false, // Only end loading when entire chain is synced
              userError: null
            });
          }, (err) => {
            setState({
              user: firebaseUser,
              profile: profileData,
              tenant: null,
              isUserLoading: false,
              userError: err
            });
          });
        } else {
          // Single-node profile (e.g. Super Admin or pending store assignment)
          setState({
            user: firebaseUser,
            profile: profileData,
            tenant: null,
            isUserLoading: false,
            userError: null
          });
        }
      }, (err) => {
        setState({ user: firebaseUser, profile: null, tenant: null, isUserLoading: false, userError: err });
      });
    }, (err) => {
      setState({ user: null, profile: null, tenant: null, isUserLoading: false, userError: err });
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