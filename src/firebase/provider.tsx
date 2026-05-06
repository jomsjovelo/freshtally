'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

interface UserAuthState {
  user: User | null;
  profile: any | null;
  tenant: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState extends UserAuthState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

export interface UserHookResult {
  user: User | null;
  profile: any | null;
  tenant: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [authState, setAuthState] = useState<UserAuthState>({
    user: null,
    profile: null,
    tenant: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    if (!auth || !firestore) return;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // RESET: Clear state immediately on auth change to prevent queries from firing with wrong context
      if (!user) {
        setAuthState({
          user: null,
          profile: null,
          tenant: null,
          isUserLoading: false,
          userError: null
        });
        return;
      }

      setAuthState(prev => ({ ...prev, user, isUserLoading: true, userError: null }));

      const profileRef = doc(firestore, "userProfiles", user.uid);
      const unsubscribeProfile = onSnapshot(profileRef, (profileSnap) => {
        if (!profileSnap.exists()) {
          // No profile found, user might need onboarding
          setAuthState({
            user,
            profile: null,
            tenant: null,
            isUserLoading: false,
            userError: null
          });
          return;
        }

        const profileData = { ...profileSnap.data(), id: profileSnap.id };
        
        if (profileData.tenantId) {
          const tenantRef = doc(firestore, "tenants", profileData.tenantId);
          const unsubscribeTenant = onSnapshot(tenantRef, (tenantSnap) => {
            // ATOMIC SYNC: Only release isUserLoading when profile AND tenant are in state
            // Even if tenant doesn't exist, we set it to null and stop loading
            setAuthState({
              user,
              profile: profileData,
              tenant: tenantSnap.exists() ? { ...tenantSnap.data(), id: tenantSnap.id } : null,
              isUserLoading: false,
              userError: null
            });
          }, (err) => {
            setAuthState(prev => ({ ...prev, isUserLoading: false, userError: err }));
          });
          return () => unsubscribeTenant();
        } else {
          setAuthState({
            user,
            profile: profileData,
            tenant: null,
            isUserLoading: false,
            userError: null
          });
        }
      }, (err) => {
        setAuthState(prev => ({ ...prev, isUserLoading: false, userError: err }));
      });

      return () => unsubscribeProfile();
    });

    return () => unsubscribeAuth();
  }, [auth, firestore]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      ...authState,
    };
  }, [firebaseApp, firestore, auth, authState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): any => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return context;
};

export const useAuth = (): Auth => useFirebase().auth;
export const useFirestore = (): Firestore => useFirebase().firestore;
export const useFirebaseApp = (): FirebaseApp => useFirebase().firebaseApp;

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T & {__memo?: boolean} {
  const memoized = useMemo(factory, deps);
  if(typeof memoized === 'object' && memoized !== null) {
    (memoized as any).__memo = true;
  }
  return memoized as any;
}

export const useUser = (): UserHookResult => {
  const { user, profile, tenant, isUserLoading, userError } = useFirebase();
  return { user, profile, tenant, isUserLoading, userError };
};