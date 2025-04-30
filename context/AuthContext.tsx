// context/AuthContext.tsx - UPDATED Login Error Handling

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert } from 'react-native'; // <--- Import Alert from react-native
import { User, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

import { auth, db } from '../firebaseConfig.js'; // Adjust path if needed

interface UserProfile {
    uid: string;
    name: string;
    class: string;
    RegisterNo: string; // <-- Match Firestore field name exactly
    email?: string; // Email used for auth
    totalPoints?: number; // Include total points if needed elsewhere in context
}

interface AuthContextType {
    user: UserProfile | null;
    loading: boolean;
    login: (registerNumber: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    register: (details: { name: string; class: string; registerNumber: string; password: string; }) => Promise<void>; // Make register mandatory now
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to construct the email Firebase uses
const constructEmail = (registerNumber: string) => `${registerNumber}@fitnessapp.local`; // Use a consistent dummy domain

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true; // Prevent state updates after unmount
        console.log('AuthContext: useEffect mounting...');
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
            console.log('AuthContext: onAuthStateChanged fired. firebaseUser:', firebaseUser?.uid || 'null');
            if (!isMounted) return; // Prevent updates if unmounted

            setLoading(true); // Set loading while potentially fetching
            if (firebaseUser) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                try {
                    const userDoc = await getDoc(userDocRef);
                    if (isMounted) { // Check again before setting state
                        if (userDoc.exists()) {
                            console.log('AuthContext: Firestore profile found for', firebaseUser.uid);
                            setUser({ uid: firebaseUser.uid, ...userDoc.data() } as UserProfile);
                        } else {
                            console.warn("AuthContext: Firestore profile NOT found for UID:", firebaseUser.uid);
                            setUser(null);
                        }
                    }
                } catch (error) {
                     console.error("AuthContext: Error fetching user profile:", error);
                     if (isMounted) setUser(null);
                } finally {
                     if (isMounted) setLoading(false);
                }
            } else {
                console.log('AuthContext: No firebaseUser found.');
                 if (isMounted) {
                    setUser(null);
                    setLoading(false);
                 }
            }
        });

        return () => {
            console.log('AuthContext: useEffect unmounting, unsubscribing.');
            isMounted = false;
            unsubscribe();
        }
    }, []);

    // --- UPDATED Login Function ---
    const login = async (registerNumber: string, password: string) => {
         setLoading(true);
         try {
             const email = constructEmail(registerNumber);
             console.log(`Attempting login for: ${email}`);
             await signInWithEmailAndPassword(auth, email, password);
             console.log(`Login successful for: ${email}`);
             // onAuthStateChanged will eventually handle setting the user state and setLoading(false)
         } catch (error: any) {
              console.error("Login Error Raw:", error); // Log the raw Firebase error
              setLoading(false); // Stop loading indicator on error

              // --- Custom Error Message Logic ---
              let userMessage = "Login failed. An unexpected error occurred."; // Default fallback

              // Check for specific Firebase Auth error codes
              if (
                  error.code === 'auth/invalid-credential' ||
                  error.code === 'auth/wrong-password' ||
                  error.code === 'auth/user-not-found' ||
                  error.code === 'auth/invalid-email' // Treat invalid format as potentially wrong Reg No
              ) {
                  userMessage = "Incorrect Password or Register Number"; // Your desired message
              } else if (error.code === 'auth/too-many-requests') {
                   userMessage = "Access temporarily disabled due to too many failed login attempts. Please try again later.";
              } else if (error.code === 'auth/network-request-failed') {
                    userMessage = "Network error. Please check your internet connection.";
              }
              // Consider adding more specific cases if needed

              Alert.alert("Login Failed", userMessage); // Show the user-friendly message
              // No need to re-throw error if Alert is handling user feedback
              // --- End Custom Error Message Logic ---
         }
         // Success case: setLoading(false) is handled by onAuthStateChanged listener
    };
    // --- End UPDATED Login Function ---

    const logout = async () => {
        console.log("Logout function CALLED in AuthContext");
        setLoading(true);
        try {
            await signOut(auth);
            console.log("Firebase signOut successful");
            // onAuthStateChanged will set user to null and setLoading(false)
        } catch (error: any) {
             console.error("Logout Error:", error);
             setLoading(false);
        }
    };

    const register = async (details: { name: string; class: string; registerNumber: string; password: string; }) => {
        setLoading(true);
        const { name, class: userClass, registerNumber, password } = details;
        const email = constructEmail(registerNumber);
        try {
            console.log(`Attempting to create auth user: ${email}`);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;
            console.log(`Auth user created successfully: ${firebaseUser.uid}`);

            const userDocRef = doc(db, 'users', firebaseUser.uid);
            console.log(`Attempting to set Firestore doc for: ${firebaseUser.uid}`);
            await setDoc(userDocRef, {
                name: name,
                class: userClass,
                RegisterNo: registerNumber, // Match Firestore field case
                email: email,
                totalPoints: 0 // Initialize points
            });
            console.log("Firestore document set successfully!");
            // Let onAuthStateChanged handle state updates
        } catch (error: any) {
            console.error("Registration Error in context:", error);
            setLoading(false); // Stop loading on error

            let errorMessage = "Registration failed. Please try again.";
            if (error.code === 'auth/email-already-in-use') { errorMessage = "This Register Number is already associated with an account."; }
            else if (error.code === 'auth/weak-password') { errorMessage = "The password is too weak (must be at least 6 characters)."; }
            else { errorMessage = error.message; }
            throw new Error(errorMessage); // Throw cleaned error to be caught by component
        }
        // Let onAuthStateChanged handle setLoading(false) on successful auth state change
    };


    // Export all necessary functions and state
    const value = { user, loading, login, logout, register };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};