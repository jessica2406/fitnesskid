// app/index.tsx (Simplified Welcome Screen - UPDATED with Buttons)

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'; // Added Alert
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LogIn, UserPlus, Dumbbell } from 'lucide-react-native'; // Added icons

export default function WelcomeScreen() {

  const handleLoginPress = () => {
    router.push('/login'); // Navigate to the login screen
  };

  const handleCreateProfilePress = () => {
    router.push('/register'); // Navigate to the register screen
    // OR use Alert if not implemented yet:
    // Alert.alert("Not Implemented", "Profile creation feature coming soon!");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* Hero Section */}
          <View style={styles.heroSection}>
              <Dumbbell size={60} color='#4f46e5' style={styles.heroIcon}/>
              <Text style={styles.appName}>FitKid</Text>
              <Text style={styles.tagline}>
                The comprehensive fitness testing app for children. Track, compare, and improve physical abilities.
              </Text>
          </View>


          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Login Button */}
            <TouchableOpacity onPress={handleLoginPress} style={[styles.button, styles.loginButton]}>
                 <LogIn size={18} color="#ffffff" style={styles.buttonIcon}/>
                 <Text style={styles.loginButtonText}>Login</Text>
             </TouchableOpacity>

             {/* Create Profile Button */}
             <TouchableOpacity onPress={handleCreateProfilePress} style={[styles.button, styles.createButton]}>
                <UserPlus size={18} color="#4f46e5" style={styles.buttonIcon} />
                <Text style={styles.createButtonText}>Create Profile</Text>
             </TouchableOpacity>
         </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles --- (Added styles for Create Profile button and icons)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  heroSection: { // Group title and tagline
      alignItems: 'center',
      width: '100%',
      marginBottom: 60, // More space before buttons
  },
  heroIcon:{
      marginBottom: 15,
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 15, // Adjusted margin
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 0, // Remove margin if buttons are directly below
    lineHeight: 24,
    maxWidth: '90%',
  },
  buttonContainer: { // Container for the two buttons
      flexDirection: 'row',
      justifyContent: 'space-around', // Space out buttons
      width: '90%', // Control overall width
      maxWidth: 500, // Max width on larger screens
  },
  button: { // Common button styles
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 25, // Adjust as needed
      borderRadius: 10,
      minWidth: 150, // Ensure minimum button width
      marginHorizontal: 10, // Add space between buttons
  },
  loginButton: {
    backgroundColor: '#4f46e5', // Primary color
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16, // Slightly smaller
    fontWeight: '600',
    textAlign: 'center',
  },
  createButton: {
      backgroundColor: '#e0e7ff', // Lighter indigo background
      borderWidth: 1.5,
      borderColor: '#4f46e5', // Primary color border
  },
  createButtonText: {
       color: '#4f46e5', // Primary color text
       fontSize: 16,
       fontWeight: '600',
       textAlign: 'center',
  },
  buttonIcon: {
      marginRight: 8, // Space between icon and text
  },
});