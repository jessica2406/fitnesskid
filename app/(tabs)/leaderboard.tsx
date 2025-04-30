// app/(tabs)/leaderboard.tsx  <-- YOUR FILENAME

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';

// --- Firestore Imports ---
import { db } from '../../firebaseConfig.js'; // Adjust path if needed
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    QueryConstraint
} from 'firebase/firestore';

// --- Interfaces ---
interface LeaderboardUser {
    id: string;
    name: string;
    class: string;
    totalPoints: number;
    avatar?: string;
    RegisterNo?: string;
}

// --- Configuration ---
// *** UPDATE THIS LIST WITH YOUR ACTUAL CLASSES FROM FIRESTORE ***
const AVAILABLE_CLASSES = ['All', '10A', '10B', '11A', '11B', '12A', '12B'];

// --- Component Definition (Name inside the file can be different from filename) ---
export default function LeaderboardScreen() { // <-- Component name
    // --- State ---
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedClass, setSelectedClass] = useState<string>('All');

    // --- Data Fetching Effect ---
    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            setError(null);
            console.log(`Fetching leaderboard for Class: ${selectedClass}`);

            try {
                const usersRef = collection(db, 'users');
                const queryConstraints: QueryConstraint[] = [];

                // Apply Class Filter
                if (selectedClass !== 'All') {
                    queryConstraints.push(where('class', '==', selectedClass));
                }

                // Apply Sorting (Requires Index!)
                queryConstraints.push(orderBy('totalPoints', 'desc'));

                // Limit results
                queryConstraints.push(limit(100));

                // Build and Execute Query
                const q = query(usersRef, ...queryConstraints);
                const querySnapshot = await getDocs(q); // Error likely occurs here if index missing

                // Process Results
                const fetchedData: LeaderboardUser[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    fetchedData.push({
                        id: doc.id,
                        name: data.name || 'Unknown Name',
                        class: data.class || 'Unknown Class',
                        totalPoints: data.totalPoints || 0,
                        RegisterNo: data.RegisterNo,
                        avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'N A')}&background=random`,
                    });
                });

                setLeaderboardData(fetchedData);
                console.log(`Fetched ${fetchedData.length} users.`);

            } catch (err: any) {
                console.error("Error fetching leaderboard:", err); // Check console!
                setError("Failed to load leaderboard. Please check your connection or Firestore setup (indexes might be required).");
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [selectedClass]);

    // --- Render List Item Function ---
    const renderLeaderboardItem = (user: LeaderboardUser, rank: number) => (
       <TouchableOpacity key={user.id} style={styles.rankingCard} activeOpacity={0.7}>
            <View style={styles.rankingLeft}>
                <Text style={styles.rankingNumber}>#{rank}</Text>
                <Image source={{ uri: user.avatar }} style={styles.rankingAvatar} />
                <View style={styles.rankingInfo}>
                    <Text style={styles.rankingName} numberOfLines={1}>{user.name}</Text>
                    <Text style={styles.rankingDetailText}>{user.class}</Text>
                </View>
            </View>
            <View style={styles.rankingRight}>
                <Text style={styles.rankingPoints}>{user.totalPoints} pts</Text>
            </View>
        </TouchableOpacity>
    );

    // --- Derive Top 3 Data ---
    const topThree = leaderboardData.slice(0, 3);
    const topThreeData = [
        topThree.find((u, i) => i === 1),
        topThree.find((u, i) => i === 0),
        topThree.find((u, i) => i === 2),
    ].filter(Boolean) as LeaderboardUser[];


    // --- Render Component UI ---
    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Leaderboard</Text>
                <Trophy size={24} color="#6366f1" />
            </View>

            {/* Filter */}
            <View style={styles.filterContainer}>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={selectedClass}
                        style={styles.picker}
                        onValueChange={(itemValue) => setSelectedClass(itemValue)}
                        mode="dropdown"
                    >
                        {AVAILABLE_CLASSES.map((cls) => (
                            <Picker.Item key={cls} label={cls} value={cls} />
                        ))}
                    </Picker>
                </View>
            </View>

            {/* Content */}
            <ScrollView style={styles.content}>
                {loading && <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 30 }} />}
                {!loading && error && <Text style={styles.errorText}>{error}</Text>}
                {!loading && !error && leaderboardData.length === 0 && (
                    <Text style={styles.emptyText}>No students found for the selected filter.</Text>
                )}
                {!loading && !error && leaderboardData.length > 0 && (
                    <>
                        {/* Top 3 Podium */}
                        {selectedClass === 'All' && topThreeData.length > 0 && (
                           <View style={styles.topThree}>
                              {topThreeData.map((user, index) => (
                                  <View
                                      key={user.id}
                                      style={[
                                          styles.topThreeCard,
                                          index === 1 ? styles.firstPlace : null,
                                          index === 0 ? styles.secondPlace : null,
                                          index === 2 ? styles.thirdPlace : null,
                                      ]}>
                                      <Image source={{ uri: user.avatar }} style={styles.topThreeAvatar} />
                                      <Text style={styles.topThreeName} numberOfLines={2}>{user.name}</Text>
                                      <Text style={styles.topThreePoints}>{user.totalPoints}</Text>
                                      <View style={[
                                          styles.rankBadge,
                                          index === 1 ? styles.firstPlaceBadge : null
                                      ]}>
                                          <Text style={styles.rankText}>
                                              #{index === 0 ? 2 : index === 1 ? 1 : 3}
                                          </Text>
                                      </View>
                                  </View>
                              ))}
                           </View>
                        )}

                        {/* Full Rankings List */}
                        <View style={styles.rankingsList}>
                            <Text style={styles.sectionTitle}>
                                {selectedClass === 'All' ? 'Overall School Rankings' : `${selectedClass} Rankings`}
                            </Text>
                            {leaderboardData.map((user, index) => renderLeaderboardItem(user, index + 1))}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// --- Styles --- (Copied from previous complete code answer)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6', },
    header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', },
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827', },
    filterContainer: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', justifyContent: 'center', },
    pickerWrapper: { flex: 1, maxWidth: 300, marginHorizontal: 5, height: 50, backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', justifyContent: 'center', overflow: 'hidden', },
    picker: { width: '100%', height: Platform.OS === 'ios' ? undefined : 50, color: '#1f2937', backgroundColor: Platform.OS === 'ios' ? 'transparent' : undefined, },
    content: { flex: 1, },
    topThree: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingVertical: 30, paddingHorizontal: 10, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', minHeight: 180, },
    topThreeCard: { alignItems: 'center', marginHorizontal: 5, width: 100, },
    firstPlace: { marginBottom: 0, transform: [{ scale: 1.15 }], zIndex: 1, },
    secondPlace: { marginBottom: 25, transform: [{ scale: 1.0 }], },
    thirdPlace: { marginBottom: 25, transform: [{ scale: 1.0 }], },
    topThreeAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: '#a5b4fc', },
    topThreeName: { fontSize: 13, fontWeight: '600', color: '#1f2937', marginTop: 8, textAlign: 'center', height: 35, overflow: 'hidden', },
    topThreePoints: { fontSize: 15, fontWeight: 'bold', color: '#4f46e5', marginTop: 4, },
    rankBadge: { position: 'absolute', top: -10, backgroundColor: '#a5b4fc', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 7, minWidth: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2, },
    firstPlaceBadge: { backgroundColor: '#f59e0b', },
    rankText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', },
    rankingsList: { padding: 15, },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 16, },
    rankingCard: { backgroundColor: '#ffffff', borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1.5, },
    rankingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10, },
    rankingNumber: { fontSize: 15, fontWeight: '700', color: '#6366f1', width: 35, textAlign: 'center', },
    rankingAvatar: { width: 40, height: 40, borderRadius: 20, marginHorizontal: 10, },
    rankingInfo: { flex: 1, },
    rankingName: { fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 2, },
    rankingDetailText: { fontSize: 13, color: '#6b7280', },
    rankingRight: { alignItems: 'flex-end', minWidth: 60, },
    rankingPoints: { fontSize: 15, fontWeight: 'bold', color: '#4f46e5', },
    errorText: { color: '#ef4444', textAlign: 'center', marginVertical: 20, paddingHorizontal: 20, fontSize: 15, },
    emptyText: { color: '#6b7280', textAlign: 'center', marginVertical: 40, fontSize: 16, },
});