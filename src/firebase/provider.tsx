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

    // Use a variable to track the current auth session to prevent race conditions during unmount/switch
    let currentSessionId = Math.random().toString(36);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setState({ user: null, profile: null, tenant: null, isUserLoading: false, userError: null });
        return;
      }

      // Start loading sequence
      setState(prev => ({ ...prev, user: firebaseUser, isUserLoading: true }));

      const userRef = doc(firestore, 'users', firebaseUser.uid);
      const unsubscribeProfile = onSnapshot(userRef, (profileSnap) => {
        if (!profileSnap.exists()) {
          // PROFILE MISSING: User is authenticated but hasn't completed onboarding/profile creation
          setState({ user: firebaseUser, profile: null, tenant: null, isUserLoading: false, userError: null });
          return;
        }

        const profileData = profileSnap.data() as UserProfile;

        if (profileData.tenantId) {
          const tenantRef = doc(firestore, 'tenants', profileData.tenantId);
          const unsubscribeTenant = onSnapshot(tenantRef, (tenantSnap) => {
            // SUCCESS: Both profile and tenant data found and synchronized
            setState({
              user: firebaseUser,
              profile: profileData,
              tenant: tenantSnap.exists() ? (tenantSnap.data() as Tenant) : null,
              isUserLoading: false,
              userError: null
            });
          }, (err) => {
            // TENANT ERROR: Most likely permission denied or node missing
            setState({
              user: firebaseUser,
              profile: profileData,
              tenant: null,
              isUserLoading: false,
              userError: err
            });
          });
          return () => unsubscribeTenant();
        } else {
          // PROFILE EXISTS BUT NO TENANT: Unusual "Zombie" state
          setState({
            user: firebaseUser,
            profile: profileData,
            tenant: null,
            isUserLoading: false,
            userError: null
          });
        }
      }, (err) => {
        // PROFILE ERROR
        setState({ user: firebaseUser, profile: null, tenant: null, isUserLoading: false, userError: err });
      });

      return () => unsubscribeProfile();
    }, (err) => {
      setState({ user: null, profile: null, tenant: null, isUserLoading: false, userError: err });
    });

    return () => unsubscribeAuth();
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