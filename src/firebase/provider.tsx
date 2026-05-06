'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
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

/**
 * ATOMIC IDENTITY HANDSHAKE PROVIDER
 * Resolves User -> Profile -> Tenant as a single unit of work.
 * Handles missing tenant documents (decommissioned stores) gracefully.
 */
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
    if (!auth || !firestore) {
      if (typeof window !== 'undefined') {
        setAuthState(prev => ({ ...prev, isUserLoading: false }));
      }
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
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

      setAuthState(prev => ({ ...prev, user, isUserLoading: true }));

      // Resolve Profile
      const profileRef = doc(firestore, "userProfiles", user.uid);
      const unsubscribeProfile = onSnapshot(profileRef, (profileSnap) => {
        if (!profileSnap.exists()) {
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
        
        // Resolve Tenant if it exists in profile
        if (profileData.tenantId) {
          const tenantRef = doc(firestore, "tenants", profileData.tenantId);
          const unsubscribeTenant = onSnapshot(tenantRef, (tenantSnap) => {
            setAuthState({
              user,
              profile: profileData,
              tenant: tenantSnap.exists() ? { ...tenantSnap.data(), id: tenantSnap.id } : null,
              isUserLoading: false,
              userError: null
            });
          }, (err) => {
            // Permission error or missing tenant handled as null
            setAuthState({
              user,
              profile: profileData,
              tenant: null,
              isUserLoading: false,
              userError: null
            });
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
      firebaseApp,
      firestore,
      auth,
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

export const useAuth = (): Auth | null => useFirebase().auth;
export const useFirestore = (): Firestore | null => useFirebase().firestore;
export const useFirebaseApp = (): FirebaseApp | null => useFirebase().firebaseApp;

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
