'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, query, collection, where, getDocs, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // First try to get user by Firebase UID (preferred method for new users)
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as Omit<User, 'id'>;
            setUser({ 
              id: firebaseUser.uid, 
              ...userData,
              createdAt: userData.createdAt instanceof Timestamp ? userData.createdAt.toDate() : (userData.createdAt as Date) || new Date(),
              dateOfBirth: userData.dateOfBirth instanceof Timestamp ? userData.dateOfBirth.toDate() : (userData.dateOfBirth as Date) || null,
              joinDate: userData.joinDate instanceof Timestamp ? userData.joinDate.toDate() : (userData.joinDate as Date) || null
            });
          } else {
            // Fallback: If user document doesn't exist with UID, search by email (for legacy users)
            const usersQuery = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
            const usersSnapshot = await getDocs(usersQuery);
            
            if (!usersSnapshot.empty) {
              const userDocSnapshot = usersSnapshot.docs[0];
              const userData = userDocSnapshot.data() as Omit<User, 'id'>;
              const userWithDates: User = { 
                id: firebaseUser.uid, // Use Firebase UID as the primary ID
                firestoreId: userDocSnapshot.id, // Keep reference to Firestore document ID
                ...userData,
                createdAt: userData.createdAt instanceof Timestamp ? userData.createdAt.toDate() : (userData.createdAt as Date) || new Date(),
                dateOfBirth: userData.dateOfBirth instanceof Timestamp ? userData.dateOfBirth.toDate() : (userData.dateOfBirth as Date) || null,
                joinDate: userData.joinDate instanceof Timestamp ? userData.joinDate.toDate() : (userData.joinDate as Date) || null
              };
              setUser(userWithDates);
            } else {
              console.warn('User authenticated but no profile found in Firestore');
              // Could create a basic profile here or redirect to profile setup
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};