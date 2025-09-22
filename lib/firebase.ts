// Firebase configuration
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {

  apiKey: "AIzaSyBHO9yPXGgzAO41avT0_Cx0srCU4qsJNfA",
  authDomain: "office-hub20.firebaseapp.com",
  projectId: "office-hub20",
  storageBucket: "office-hub20.firebasestorage.app",
  messagingSenderId: "505799604311",
  appId: "1:505799604311:web:cddb3a4884d50d628fcb12",
  measurementId: "G-NPNF7Z01JM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Create a secondary app for admin operations (creating users without affecting current session)
export const createSecondaryApp = () => {
  const secondaryApp = initializeApp(firebaseConfig, 'secondary');
  return {
    auth: getAuth(secondaryApp),
    app: secondaryApp,
    delete: async () => {
      try {
        await deleteApp(secondaryApp);
      } catch (error) {
        console.warn('Error deleting secondary app:', error);
        // Don't throw error - app deletion is cleanup, not critical
      }
    }
  };
};


export const messaging = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    return getMessaging(app);
  }
  return null;
};

export default app;