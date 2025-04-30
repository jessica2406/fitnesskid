// firebaseConfig.js - UPDATED

import { Platform } from 'react-native'; // Import Platform
import { initializeApp, getApps, getApp } from 'firebase/app'; // Import getApps and getApp
import {
    getAuth,
    // initializeAuth, // Usually not needed after app init, using getAuth instead
    getReactNativePersistence, // For Native
    indexedDBLocalPersistence, // Preferred for Web Persistence
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration (using your provided values)
const firebaseConfig = {
    apiKey: "AIzaSyDS5vlN9_ncKSXGwOkLFt7sriyL3OY1B2s",
    authDomain: "fitkid-f25f4.firebaseapp.com",
    projectId: "fitkid-f25f4",
    // Ensure storageBucket does NOT end with a '/'
    storageBucket: "fitkid-f25f4.appspot.com", // Corrected from .firebasestorage.app
    messagingSenderId: "224345900339",
    appId: "1:224345900339:web:b5a99c2a5eea35f32a6a46",
    measurementId: "G-G9DW75KDEK" // measurementId is often optional for Auth/Firestore
};


// --- Initialize Firebase App (Check if already initialized) ---
let app;
if (getApps().length === 0) {
    // Initialize Firebase if no apps exist
    app = initializeApp(firebaseConfig);
    console.log("Firebase Initialized"); // Optional: Log initialization
} else {
    // Get the default app if it already exists
    app = getApp();
    console.log("Firebase Already Initialized - Reusing Instance"); // Optional: Log reuse
}
// --- End App Initialization ---


// Select Persistence based on Platform
const persistence = Platform.OS === 'web'
    ? indexedDBLocalPersistence
    : getReactNativePersistence(AsyncStorage);

// Initialize Auth with the selected persistence, using the 'app' instance
// Using getAuth(app) is generally preferred and simpler after app init.
const auth = getAuth(app, {
    // If you still need initializeAuth for specific options,
    // you'd need to wrap it in a check similar to the app init check.
    // persistence: persistence // getAuth doesn't take persistence here
});


// Initialize Firestore using the 'app' instance
const db = getFirestore(app);

export { auth, db }; // Export initialized instances