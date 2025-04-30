// app/_layout.tsx - Simplified useEffect for Login/Logout Redirect

import React, { useEffect } from 'react'; // Removed useState import
import { Stack, SplashScreen, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LogBox } from 'react-native'; // Keep LogBox import if needed

// --- Ignore Specific Warning ---
LogBox.ignoreLogs([
  'Warning: Text strings must be rendered within a <Text> component.',
  'AuthContext: Login function ERROR:', // Keep this if you still want to hide login errors
]);
// -----------------------------

SplashScreen.preventAutoHideAsync();

// RootLayout remains the main export
export default function RootLayout() {
  return (
    <AuthProvider>
      <Layout />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

// Layout component now ONLY returns the Stack when ready
function Layout() {
  const { loading: authLoading, user } = useAuth();
  // REMOVED: const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);

  useEffect(() => {
    const timestamp = () => new Date().toLocaleTimeString();
    console.log(`Layout Effect: [${timestamp()}] Running. authLoading=${authLoading}, userExists=${!!user}`);

    // Only proceed when the auth check is complete
    if (!authLoading) {
        console.log(`Layout Effect: [${timestamp()}] Auth loading is FALSE. Hiding splash screen and performing redirect check...`);
        SplashScreen.hideAsync(); // Hide splash screen now

        // Determine target route based on user state
        const targetRoute = user ? '/dashboard' : '/'; // If user exists go to dashboard, else go to welcome '/'
        console.log(`Layout Effect: [${timestamp()}] User state resolved. Target route: ${targetRoute}`);

        // Use replace to navigate. This avoids adding to history stack.
        router.replace(targetRoute);
        console.log(`Layout Effect: [${timestamp()}] router.replace('${targetRoute}') called.`);

    } else {
         console.log(`Layout Effect: [${timestamp()}] Auth still loading...`);
    }
    // Effect runs whenever authLoading or user changes
  }, [authLoading, user]); // DEPEND ONLY ON authLoading and user


  // Render nothing while the auth check is happening
  // The useEffect above will handle the navigation once loading is false
  if (authLoading) {
    console.log(`Layout Render: [${new Date().toLocaleTimeString()}] Waiting (authLoading=${authLoading}). Returning null.`);
    return null;
  }

  // Once loading is false, the useEffect has handled the redirect.
  // Render the Stack which contains all possible routes.
  console.log(`Layout Render: [${new Date().toLocaleTimeString()}] Auth resolved. Rendering Stack Navigator.`);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}