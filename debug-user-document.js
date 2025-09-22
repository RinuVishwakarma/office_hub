// Add this to your browser console to debug user document structure
// After logging in, run this in the browser console:

import { auth, db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function debugUserDocument() {
  const user = auth.currentUser;
  if (!user) {
    console.log('No authenticated user');
    return;
  }
  
  console.log('Auth User ID:', user.uid);
  console.log('Auth User Email:', user.email);
  
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      console.log('User Document Data:', userDoc.data());
      console.log('User Role:', userDoc.data().role);
    } else {
      console.log('❌ User document does not exist in Firestore!');
      console.log('This is why the rules are failing.');
    }
  } catch (error) {
    console.error('Error fetching user document:', error);
  }
}

// Run the debug function
debugUserDocument();
