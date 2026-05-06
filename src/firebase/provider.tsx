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
      // Clear previous subs on auth change
      if (profileUnsub) profileUnsub();
      if (tenantUnsub) tenantUnsub();

      if (!firebaseUser) {
        setState({ user: null, profile: null, tenant: null, isUserLoading: false, userError: null });
        return;
      }

      // Sync Profile
      const userRef = doc(firestore, 'users', firebaseUser.uid);
      profileUnsub = onSnapshot(userRef, (profileSnap) => {
        if (!profileSnap.exists()) {
          // Profile document doesn't exist yet (e.g. during onboarding propagation)
          setState(prev => ({ ...prev, user: firebaseUser, isUserLoading: false }));
          return;
        }

        const profileData = profileSnap.data() as UserProfile;

        // If user has a tenant, sync tenant data before ending loading state
        if (profileData.tenantId) {
          const tenantRef = doc(firestore, 'tenants', profileData.tenantId);
          if (tenantUnsub) tenantUnsub();
          
          tenantUnsub = onSnapshot(tenantRef, (tenantSnap) => {
            setState({
              user: firebaseUser,
              profile: profileData,
              tenant: tenantSnap.exists() ? (tenantSnap.data() as Tenant) : null,
              isUserLoading: false,
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
          // No tenant (e.g. super admin)
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
