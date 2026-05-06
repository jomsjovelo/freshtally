'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
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

    const authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
      // 1. Handle Unauthenticated State
      if (!firebaseUser) {
        setState({ 
          user: null, 
          profile: null, 
          tenant: null, 
          isUserLoading: false, 
          userError: null, 
          storeNotFound: false 
        });
        return;
      }

      // 2. Handle Authenticated State (Atomic Fetch)
      // Ensure we don't set loading to false until profile AND tenant (if applicable) are fetched
      setState(prev => ({ ...prev, user: firebaseUser, isUserLoading: true }));

      try {
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        const profileSnap = await getDoc(userRef);

        if (!profileSnap.exists()) {
          setState({ 
            user: firebaseUser, 
            profile: null, 
            tenant: null, 
            isUserLoading: false, 
            userError: null, 
            storeNotFound: false 
          });
          return;
        }

        const profileData = profileSnap.data() as UserProfile;

        if (profileData.tenantId) {
          const tenantRef = doc(firestore, 'tenants', profileData.tenantId);
          const tenantSnap = await getDoc(tenantRef);

          if (tenantSnap.exists()) {
            setState({
              user: firebaseUser,
              profile: profileData,
              tenant: tenantSnap.data() as Tenant,
              isUserLoading: false,
              userError: null,
              storeNotFound: false
            });
          } else {
            // Store exists in profile but not in collection (deleted)
            setState({
              user: firebaseUser,
              profile: profileData,
              tenant: null,
              isUserLoading: false,
              userError: null,
              storeNotFound: true
            });
          }
        } else {
          // No tenant ID associated yet (e.g. fresh register)
          setState({ 
            user: firebaseUser, 
            profile: profileData, 
            tenant: null, 
            isUserLoading: false, 
            userError: null, 
            storeNotFound: false 
          });
        }
      } catch (err: any) {
        setState({ 
          user: firebaseUser, 
          profile: null,
          tenant: null,
          isUserLoading: false, 
          userError: err,
          storeNotFound: false
        });
      }
    });

    return () => authUnsub();
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