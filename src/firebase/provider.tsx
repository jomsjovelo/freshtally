
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

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Cleanup existing listeners on auth change
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

      // 1. Subscribe to User Profile
      const profileRef = doc(firestore, 'userProfiles', user.uid);
      unsubProfile = onSnapshot(profileRef, (profileSnap) => {
        if (!profileSnap.exists()) {
          setAuthState(s => ({ ...s, user, isUserLoading: false }));
          return;
        }

        const profileData = profileSnap.data() as UserProfile;
        
        // 2. Cleanup tenant listener if tenantId changes
        if (unsubTenant) unsubTenant();
        unsubTenant = null;

        if (profileData.tenantId) {
          const tenantRef = doc(firestore, 'tenants', profileData.tenantId);
          unsubTenant = onSnapshot(tenantRef, (tenantSnap) => {
            setAuthState({
              user,
              profile: profileData,
              tenant: tenantSnap.exists() ? (tenantSnap.data() as TenantData) : null,
              isUserLoading: false,
              userError: null
            });
          });
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
        console.error("Profile sync error:", err);
        setAuthState(s => ({ ...s, isUserLoading: false }));
      });
    }, (error) => {
      setAuthState(s => ({ ...s, userError: error, isUserLoading: false }));
    });

    // Final effect cleanup
    return () => {
      unsubscribeAuth();
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
