import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { 
  auth, 
  db, 
  loginWithGoogle, 
  loginWithGoogleRedirect,
  checkRedirectResult,
  logoutUser, 
  handleFirestoreError, 
  OperationType, 
  testConnection,
  FIREBASE_PROJECT_ID
} from '../firebase';

export interface AuthErrorState {
  code: string;
  message: string;
  domain: string;
  projectId: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  authError: AuthErrorState | null;
  login: () => Promise<void>;
  loginRedirect: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  authError: null,
  login: async () => {},
  loginRedirect: async () => {},
  logout: async () => {},
  clearAuthError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<AuthErrorState | null>(null);

  useEffect(() => {
    testConnection();

    // Check if user just returned from a redirect flow
    checkRedirectResult()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
        }
      })
      .catch((err) => {
        console.warn('Redirect auth check error:', err);
        setAuthError({
          code: err?.code || 'auth/redirect-error',
          message: err?.message || 'Fehler bei der Weiterleitung',
          domain: window.location.hostname,
          projectId: FIREBASE_PROJECT_ID,
        });
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);

      if (user) {
        setAuthError(null);
        // Sync user profile to Firestore
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const snapshot = await getDoc(userDocRef);
          if (!snapshot.exists()) {
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Bitcoin Investor',
              photoURL: user.photoURL || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else {
            await setDoc(userDocRef, {
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        } catch (error) {
          console.warn('User profile sync notice:', error);
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Login failure:', err);
      setAuthError({
        code: err?.code || 'auth/unknown',
        message: err?.message || 'Unbekannter Anmeldefehler',
        domain: window.location.hostname,
        projectId: FIREBASE_PROJECT_ID,
      });
    }
  };

  const loginRedirect = async () => {
    setAuthError(null);
    try {
      await loginWithGoogleRedirect();
    } catch (err: any) {
      console.error('Login redirect failure:', err);
      setAuthError({
        code: err?.code || 'auth/unknown',
        message: err?.message || 'Unbekannter Anmeldefehler',
        domain: window.location.hostname,
        projectId: FIREBASE_PROJECT_ID,
      });
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
      setAuthError(null);
    } catch (err) {
      console.error('Logout failure:', err);
      throw err;
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      loading, 
      authError, 
      login, 
      loginRedirect, 
      logout, 
      clearAuthError 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
