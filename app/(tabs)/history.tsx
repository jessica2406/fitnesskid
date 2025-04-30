// app/(tabs)/history.tsx - CORRECTED VERSION (No testData reference)

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext'; // Adjust path if needed
import { db } from '../../firebaseConfig'; // Adjust path if needed
import { collection, query, orderBy, getDocs, Timestamp, doc, deleteDoc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { History, Award, Trash2, Edit } from 'lucide-react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router'; // Import useFocusEffect

interface TestHistoryItem {
    id: string; // Firestore document ID
    testId: string; // e.g., 'queens', 'beep'
    testName: string;
    timestamp: Timestamp | null;
    resultValue: number | string | null;
    rating: string | null;
    pointsAwarded: number;
    inputs: Record<string, string>; // Stored inputs from when test was taken
}

export default function HistoryScreen() {
    const { user } = useAuth();
    const [history, setHistory] = useState<TestHistoryItem[]>([]);
    const [totalPoints, setTotalPoints] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // --- Fetch History Logic ---
    const fetchHistory = useCallback(async (showLoader = true) => { // Added optional param
        if (!user) {
            setLoading(false);
            setRefreshing(false);
            setHistory([]);
            setTotalPoints(0);
            return;
        }

        if (showLoader) setLoading(true); 

        try {
            console.log("Fetching history for user:", user.uid);
            const historyCollectionRef = collection(db, 'users', user.uid, 'testHistory');
            const q = query(historyCollectionRef, orderBy('timestamp', 'desc'));

            const querySnapshot = await getDocs(q);
            let pointsSum = 0;
            const fetchedHistory: TestHistoryItem[] = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.timestamp && data.testName && data.testId && data.inputs) {
                    const points = data.pointsAwarded || 0;
                    pointsSum += points;
                    fetchedHistory.push({
                        id: doc.id,
                        testId: data.testId,
                        testName: data.testName,
                        timestamp: data.timestamp as Timestamp,
                        resultValue: data.resultValue,
                        rating: data.rating || null,
                        pointsAwarded: points,
                        inputs: data.inputs,
                    });
                } else {
                    console.warn("Skipping history item with missing data:", doc.id, data);
                }
            });

            console.log("Fetched history count:", fetchedHistory.length);
            setHistory(fetchedHistory);
            setTotalPoints(pointsSum);

        } catch (error) {
            console.error("Error fetching test history: ", error);
            Alert.alert("Error", "Could not fetch test history.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    // Fetch data when screen comes into focus using useFocusEffect
    useFocusEffect(
      useCallback(() => {
        console.log("History screen focused, fetching data...");
        fetchHistory(true); // Fetch data and show loader on focus
      }, [fetchHistory]) // Depend on the memoized fetch function
    );


    // --- Pull to Refresh ---
    const onRefresh = useCallback(() => {
        console.log("Refreshing history...");
        setRefreshing(true);
        fetchHistory(false); // Fetch data but don't show main loader
    }, [fetchHistory]);

    // --- DELETE Logic ---
    // --- Inside your HistoryScreen component ---
// Assume you have a function like this:
const handleDeleteTest = async (testHistoryItemId: string) => {
    if (!user) return;

    Alert.alert("Confirm Deletion", "...", [
        { text: "Cancel", style: "cancel" },
        {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
                setLoading(true); // Or some specific deleting state
                try {
                    const itemDocRef = doc(db, 'users', user.uid, 'testHistory', testHistoryItemId);

                    // *** DELETE THE DOCUMENT ***
                    await deleteDoc(itemDocRef);
                    console.log(`Deleted test history item: ${testHistoryItemId}`);

                    // Update local UI state immediately
                    setHistory(prev => prev.filter(item => item.id !== testHistoryItemId));

                    // ---------- START: RECALCULATE AND UPDATE TOTAL POINTS ----------
                    try {
                        console.log("Attempting to recalculate total points after deletion...");
                        const historyCollectionRef = collection(db, 'users', user.uid, 'testHistory');
                        // 1. Fetch all *remaining* test results
                        const allTestsSnapshot = await getDocs(historyCollectionRef);

                        // 2. Calculate the new total sum
                        let newTotal = 0;
                        allTestsSnapshot.forEach((testDoc) => {
                            const points = testDoc.data()?.pointsAwarded;
                            newTotal += (typeof points === 'number' ? points : 0);
                        });
                        console.log(`New calculated total points after deletion: ${newTotal}`);

                        // 3. Get reference to the main user document
                        const userDocRef = doc(db, 'users', user.uid);

                        // 4. Update the totalPoints field
                        await updateDoc(userDocRef, {
                            totalPoints: newTotal
                        });
                        console.log("Successfully updated user's totalPoints in Firestore after deletion.");

                    } catch (updateError: any) {
                        console.error("Error updating total points after deletion:", updateError);
                         // Log error, maybe show non-blocking feedback later
                    }
                    // ---------- END: RECALCULATE AND UPDATE TOTAL POINTS ----------

                    Alert.alert("Success", "Test record deleted.");

                } catch (deleteError: any) {
                    console.error("Error deleting test record:", deleteError);
                    Alert.alert("Error", `Could not delete test record: ${deleteError.message}`);
                } finally {
                    setLoading(false);
                }
            }
        }
    ]);
};

    // --- EDIT Logic ---
    const handleEditTest = (itemToEdit: TestHistoryItem) => {
         if (!itemToEdit.inputs) {
             Alert.alert("Error", "Cannot edit this entry as original inputs are missing.");
             return;
         }
         console.log("Attempting to edit:", itemToEdit.id, "Test ID:", itemToEdit.testId);
         console.log("Original Inputs:", itemToEdit.inputs);

         const stringifiedInputs = Object.fromEntries(
            Object.entries(itemToEdit.inputs).map(([key, value]) => [key, String(value)])
         );

         router.push({
             pathname: `/tests/${itemToEdit.testId}`,
             params: {
                 historyDocId: itemToEdit.id,
                 ...stringifiedInputs
             }
         });
    };

    // --- Render Item Function ---
    const renderHistoryItem = ({ item }: { item: TestHistoryItem }) => (
        <View style={styles.historyItem}>
            <View style={styles.itemContent}>
                {/* ... (Test Name, Points, Timestamp, Results) ... */}
                <View style={styles.itemHeader}>
                    <Text style={styles.testName}>{item.testName}</Text>
                    <Text style={styles.points}>+{item.pointsAwarded} pts</Text>
                </View>
                <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
                <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Result:</Text>
                    <Text style={styles.resultValue}>{item.resultValue ?? 'N/A'}</Text>
                </View>
                {item.rating && (
                    <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Rating:</Text>
                        <Text style={styles.resultValue}>{item.rating}</Text>
                    </View>
                )}
            </View>
            <View style={styles.actionButtonsContainer}>
                
                {/* --- UPDATED Delete Button onPress --- */}
                 <TouchableOpacity
                     onPress={() => handleDeleteTest(item)} // Direct call, removed extra console log here
                     style={[styles.actionButton, styles.deleteButton]}
                 >
                      <Trash2 size={18} color="#ef4444" />
                 </TouchableOpacity>
                {/* --- END UPDATE --- */}
            </View>
        </View>
    );
    // Helper to format timestamp
    const formatTimestamp = (timestamp: Timestamp | null): string => {
        if (!timestamp) return 'Date N/A'; try { return timestamp.toDate().toLocaleString(); } catch (e) { return 'Invalid Date'; }
    };

    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Test History</Text>
                <History size={24} color="#6366f1" />
            </View>

            <View style={styles.totalPointsContainer}>
                 <Award size={28} color="#fbbf24" />
                 <View style={styles.totalPointsTextContainer}>
                    <Text style={styles.totalPointsLabel}>Total Points Earned</Text>
                    <Text style={styles.totalPointsValue}>{loading ? '...' : totalPoints}</Text>
                 </View>
            </View>

            {loading ? (
                <ActivityIndicator style={styles.loader} size="large" color="#6366f1" />
            ) : (
                <FlatList
                    data={history}
                    renderItem={renderHistoryItem}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No tests taken yet.</Text>}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#6366f1"]}/>
                    }
                />
            )}
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6', },
    header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', },
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827', },
    totalPointsContainer: { backgroundColor: '#6366f1', paddingVertical: 15, paddingHorizontal: 20, marginHorizontal: 15, marginVertical: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, },
    totalPointsTextContainer:{ marginLeft: 15, },
    totalPointsLabel: { color: '#e0e7ff', fontSize: 14, marginBottom: 2, },
    totalPointsValue: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center'},
    list: { flex: 1, },
    listContent: { paddingHorizontal: 15, paddingBottom: 20, },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#6b7280', },
    historyItem: { backgroundColor: '#ffffff', borderRadius: 10, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingLeft: 15, paddingRight: 5, },
    itemContent: { flex: 1, marginRight: 10, },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, },
    testName: { fontSize: 16, fontWeight: '600', color: '#1f2937', flexShrink: 1, marginRight: 10, },
    points: { fontSize: 15, fontWeight: 'bold', color: '#6366f1', },
    timestamp: { fontSize: 12, color: '#6b7280', marginBottom: 10, },
    resultRow: { flexDirection: 'row', marginTop: 4, },
    resultLabel: { fontSize: 14, color: '#4b5563', fontWeight: '500', marginRight: 5, minWidth: 50, },
    resultValue: { fontSize: 14, color: '#1f2937', fontWeight: '500', flexShrink: 1, },
    actionButtonsContainer: { flexDirection: 'column', justifyContent: 'space-around', marginLeft: 10, },
    actionButton: { padding: 8, marginBottom: 5, },
    editButton: { },
    deleteButton: { },
});