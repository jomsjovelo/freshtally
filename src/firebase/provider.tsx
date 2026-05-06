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
 * ATOMIC IDENTITY HANDSHAKE PROVIDER (v2.0)
 * Sequence: User (Auth) -> Profile (Firestore) -> Tenant (Firestore).
 * Logic ensures child states are cleared immediately when parents change to prevent permission leaks.
 * Hardened to prevent race conditions during list operations.
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

  // 1. AUTH WATCHER
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

  // 2. PROFILE WATCHER: Chained to User
  useEffect(() => {
    if (!user || !firestore) {
      setProfile(null);
      setTenant(null);
      if (!user) setIsUserLoading(false);
      return;
    }

    setIsUserLoading(true);
    const profileRef = doc(firestore, "userProfiles", user.uid);
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const profileData = { ...snap.data(), id: snap.id };
        setProfile(profileData);
        // If profile exists but has no tenant, we stop loading
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
      setProfile(null);
      setTenant(null);
      setUserError(err);
      setIsUserLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user, firestore]);

  // 3. TENANT WATCHER: Chained to Profile
  useEffect(() => {
    if (!profile?.tenantId || !firestore) {
      setTenant(null);
      if (profile && !profile.tenantId) setIsUserLoading(false);
      return;
    }

    setIsUserLoading(true);
    const tenantRef = doc(firestore, "tenants", profile.tenantId);
    const unsubscribeTenant = onSnapshot(tenantRef, (snap) => {
      if (snap.exists()) {
        setTenant({ ...snap.data(), id: snap.id });
      } else {
        setTenant(null);
      }
      setIsUserLoading(false);
    }, (err) => {
      setTenant(null);
      setUserError(err);
      setIsUserLoading(false);
    });

    return () => unsubscribeTenant();
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

export const useFirebase = (): FirebaseContextState => {
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
