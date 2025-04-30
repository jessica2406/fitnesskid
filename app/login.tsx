// app/login.tsx
import React, { useState /* Remove useEffect if only used for clearLoginError */ } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { Lock, User } from 'lucide-react-native'; // Example icons

export default function LoginScreen() {
    const [registerNumber, setRegisterNumber] = useState('');
    const [password, setPassword] = useState('');
    // --- REMOVE loginError and clearLoginError ---
    const { login, loading } = useAuth(); // Only get what the context actually provides

    const handleLogin = async () => {
        if (!registerNumber || !password) {
            // Keep this client-side validation alert
            Alert.alert("Input Required", "Please enter both Register Number and Password.");
            return;
        }
        // Login errors are now handled by Alert.alert inside the login function in the context
        await login(registerNumber, password);
        // Navigation is handled by root layout based on auth state change
    };

    // --- REMOVE this useEffect block ---
    // useEffect(() => {
    //     if (registerNumber || password) {
    //         clearLoginError(); // This function doesn't exist in the current context
    //     }
    // }, [registerNumber, password, clearLoginError]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Login with your credentials</Text>

                <View style={styles.inputContainer}>
                    <User size={20} color="#6b7280" style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Register Number" // Adjust placeholder if needed
                        value={registerNumber}
                        onChangeText={setRegisterNumber}
                        keyboardType="numeric" // Or default/email-address as appropriate
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Lock size={20} color="#6b7280" style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                {/* --- REMOVE this error display block if it exists --- */}
                {/* {loginError && (
                    <Text style={styles.errorText}>{loginError}</Text>
                )} */}

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <Text style={styles.buttonText}>Login</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// Styles remain the same, but you can remove errorText if unused
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
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
        marginBottom: 40,
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
        backgroundColor: '#6366f1',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
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
    // Remove this if you removed the error Text component
    // errorText: {
    //     color: '#ef4444',
    //     fontSize: 14,
    //     textAlign: 'center',
    //     marginBottom: 15,
    //     marginTop: -5,
    // },
});