// app/register.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext'; // Adjust path if needed
import { router } from 'expo-router'; // For navigation
import { UserPlus, Hash, Lock, User as UserIcon, Bookmark } from 'lucide-react-native'; // Icons

export default function RegisterScreen() {
    const [name, setName] = useState('');
    const [userClass, setUserClass] = useState(''); // Use different name than keyword 'class'
    const [registerNumber, setRegisterNumber] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { register, loading } = useAuth(); // Get register function and loading state

    const handleRegister = async () => {
        // Basic Validation
        if (!name || !userClass || !registerNumber || !password || !confirmPassword) {
            Alert.alert("Input Required", "Please fill in all fields.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Password Mismatch", "Passwords do not match.");
            return;
        }
        if (password.length < 6) {
             Alert.alert("Password Too Short", "Password must be at least 6 characters long.");
             return;
        }

        if (register) { // Ensure register function exists in context
            try {
                await register({ name, class: userClass, registerNumber, password });
                Alert.alert(
                    "Registration Successful",
                    "Your profile has been created. Please login.",
                    [{ text: "OK", onPress: () => router.replace('/login') }] // Navigate to login after success
                );
            } catch (error: any) {
                // Error alerts are often handled within the register function in AuthContext
                // But we can add a fallback here if needed
                console.log("Registration attempt failed in component:", error.message);
                 if (!error.message.includes("Registration failed:")) { // Avoid double alerts
                     Alert.alert("Registration Failed", error.message || "An unknown error occurred.");
                 }
            }
        } else {
            Alert.alert("Error", "Registration function not available.");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.content}>
                    {/* Back Button (optional but good UX) */}
                    {/* <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color="#4B5563" />
                    </TouchableOpacity> */}

                    <Text style={styles.title}>Create Profile</Text>
                    <Text style={styles.subtitle}>Enter your details to register</Text>

                    {/* Input Fields */}
                    <View style={styles.inputContainer}>
                        <UserIcon size={20} color="#6b7280" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                    </View>

                     <View style={styles.inputContainer}>
                        <Bookmark size={20} color="#6b7280" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Class (e.g., 10A, 11B)"
                            value={userClass}
                            onChangeText={setUserClass}
                            autoCapitalize="characters"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Hash size={20} color="#6b7280" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Register Number"
                            value={registerNumber}
                            onChangeText={setRegisterNumber}
                            keyboardType="numeric" // Or default if letters allowed
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Lock size={20} color="#6b7280" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password (min. 6 characters)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Lock size={20} color="#6b7280" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    </View>

                    {/* Register Button */}
                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <>
                                <UserPlus size={18} color="#ffffff" style={{marginRight: 8}} />
                                <Text style={styles.buttonText}>Register</Text>
                            </>
                        )}
                    </TouchableOpacity>

                     {/* Link to Login */}
                     <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginLink}>
                         <Text style={styles.loginLinkText}>Already have an account? Login</Text>
                     </TouchableOpacity>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// Use similar styles to login.tsx, adjust as needed
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center', // Center content vertically
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 30, // Reduced margin
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        marginBottom: 15,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#d1d5db',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: 16,
        color: '#111827',
    },
    button: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#6366f1', // Use primary color
        borderRadius: 12,
        paddingVertical: 15,
        marginTop: 20,
    },
    buttonDisabled: {
        backgroundColor: '#a5b4fc',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
     loginLink: {
         marginTop: 25,
         alignItems: 'center',
     },
     loginLinkText: {
         color: '#6366f1',
         fontSize: 15,
         fontWeight: '500',
     },
});