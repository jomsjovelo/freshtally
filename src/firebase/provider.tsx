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
 * Chained resolution: User -> Profile -> Tenant.
 * Ensures proper unsubscription and state synchronization.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [tenant, setTenant] = useState<any | null>(null);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(true);
  const [userError, setUserError] = useState<Error | null>(null);

  // 1. Listen for Auth Changes
  useEffect(() => {
    if (!auth) {
      setIsUserLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setProfile(null);
        setTenant(null);
        setIsUserLoading(false);
      }
    }, (err) => {
      setUserError(err);
      setIsUserLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  // 2. Listen for Profile Changes (Chained to User)
  useEffect(() => {
    if (!user || !firestore) return;

    setIsUserLoading(true);
    const profileRef = doc(firestore, "userProfiles", user.uid);
    const unsubscribe = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const profileData = { ...snap.data(), id: snap.id };
        setProfile(profileData);
        if (!profileData.tenantId) {
          setTenant(null);
          setIsUserLoading(false);
        }
      } else {
        setProfile(null);
        setTenant(null);
        setIsUserLoading(false);
      }
    }, (err) => {
      setUserError(err);
      setIsUserLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  // 3. Listen for Tenant Changes (Chained to Profile)
  useEffect(() => {
    if (!profile?.tenantId || !firestore) {
      if (profile && !profile.tenantId) setIsUserLoading(false);
      return;
    }

    const tenantRef = doc(firestore, "tenants", profile.tenantId);
    const unsubscribe = onSnapshot(tenantRef, (snap) => {
      if (snap.exists()) {
        setTenant({ ...snap.data(), id: snap.id });
      } else {
        setTenant(null);
      }
      setIsUserLoading(false);
    }, (err) => {
      setTenant(null);
      setIsUserLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.tenantId, firestore]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp,
      firestore,
      auth,
      user,
      profile,
      tenant,
      isUserLoading,
      userError,
    };
  }, [firebaseApp, firestore, auth, user, profile, tenant, isUserLoading, userError]);

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
