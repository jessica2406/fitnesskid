// app/(tabs)/dashboard.tsx - UPDATED to show POINTS in recent tests

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Award, TrendingUp, Timer, Dumbbell, Trophy, LogOut } from 'lucide-react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext'; // Correct relative path assumed
import { db } from '../../firebaseConfig'; // Correct relative path assumed
import { collection, query, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { useFocusEffect } from 'expo-router';

// Interface for display item in recent tests list
interface RecentTestDisplayItem {
    id: string;
    name: string;
    // score: number | string | null; // We'll display points instead
    points: number; // Store the points awarded
    date: string; // Formatted date string
}

export default function DashboardScreen() {
  const { user, logout, loading: authLoading } = useAuth();
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [testsCompleted, setTestsCompleted] = useState<number | null>(null);
  const [recentTestsData, setRecentTestsData] = useState<RecentTestDisplayItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Helper to format timestamp
  const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'Date N/A';
    try {
      return timestamp.toDate().toLocaleDateString();
    } catch (e) {
      console.error("Error formatting date:", e)
      return 'Invalid Date';
    }
  };

  // Function to fetch stats AND recent tests from Firestore
  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setTotalPoints(0);
      setTestsCompleted(0);
      setRecentTestsData([]);
      setLoadingStats(false);
      setRefreshing(false);
      return;
    }

    setLoadingStats(true);
    console.log(`Fetching dashboard data for user: ${user.uid}`);

    try {
      const historyCollectionRef = collection(db, 'users', user.uid, 'testHistory');

      // --- Fetch ALL history for Stats ---
      const statsQuery = query(historyCollectionRef);
      const statsSnapshot = await getDocs(statsQuery);
      let pointsSum = 0;
      statsSnapshot.forEach((doc) => {
        pointsSum += doc.data().pointsAwarded || 0;
      });
      setTotalPoints(pointsSum);
      setTestsCompleted(statsSnapshot.size);
      console.log(`Fetched stats: Points=${pointsSum}, Count=${statsSnapshot.size}`);

      // --- Fetch LATEST 3 history items ---
      const recentQuery = query(historyCollectionRef, orderBy('timestamp', 'desc'), limit(3));
      const recentSnapshot = await getDocs(recentQuery);

      const fetchedRecentTests: RecentTestDisplayItem[] = [];
      recentSnapshot.forEach((doc) => {
          const data = doc.data();
           if (data.testName && data.timestamp) {
                fetchedRecentTests.push({
                    id: doc.id,
                    name: data.testName,
                    // score: data.resultValue ?? 'N/A', // No longer mapping score for display here
                    points: data.pointsAwarded || 0, // <-- Get pointsAwarded
                    date: formatTimestamp(data.timestamp as Timestamp),
                });
           }
      });
      setRecentTestsData(fetchedRecentTests);
      console.log(`Fetched recent tests: Count=${fetchedRecentTests.length}`);

    } catch (error) {
      console.error("Error fetching dashboard data: ", error);
      setTotalPoints(0);
      setTestsCompleted(0);
      setRecentTestsData([]);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, [user]);

  // Fetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("Dashboard screen focused, fetching data...");
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  // Handler for pull-to-refresh
  const onRefresh = useCallback(() => {
    console.log("Refreshing dashboard data...");
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header remains the same */}
      <View style={styles.header}>
         <View>
           <Text style={styles.welcomeText}>Welcome back,</Text>
           <Text style={styles.userName}>{user?.name || 'User'}</Text>
         </View>
         <TouchableOpacity onPress={handleLogout} disabled={authLoading} style={styles.logoutIcon}>
              <LogOut size={24} color="#ef4444"/>
          </TouchableOpacity>
       </View>

      <ScrollView
        style={styles.content}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#6366f1"]}/>
        }
      >
         {/* Stats Container remains the same */}
         <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Award size={24} color="#6366f1" />
              {loadingStats ? (
                  <ActivityIndicator size="small" color="#6366f1" style={styles.statLoader}/>
              ) : (
                  <Text style={styles.statValue}>{totalPoints ?? '--'}</Text>
              )}
              <Text style={styles.statLabel}>Total Points</Text>
            </View>
            <View style={styles.statCard}>
              <TrendingUp size={24} color="#6366f1" />
               {loadingStats ? (
                  <ActivityIndicator size="small" color="#6366f1" style={styles.statLoader}/>
              ) : (
                  <Text style={styles.statValue}>{testsCompleted ?? '--'}</Text>
              )}
              <Text style={styles.statLabel}>Tests Completed</Text>
            </View>
          </View>

         {/* Quick Actions remains the same */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <Link href="/tests" asChild>
                <TouchableOpacity style={styles.actionButton}>
                  <Timer size={24} color="#6366f1" />
                  <Text style={styles.actionButtonText}>Start New Test</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/leaderboard" asChild>
                <TouchableOpacity style={styles.actionButton}>
                  <Trophy size={24} color="#6366f1" />
                  <Text style={styles.actionButtonText}>View Rankings</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

         {/* --- UPDATED Recent Tests Section --- */}
         <View style={styles.section}>
           <Text style={styles.sectionTitle}>Recent Tests</Text>
           {loadingStats ? (
                <ActivityIndicator size="small" color="#6366f1" style={{marginTop: 20}}/>
            ) : recentTestsData.length > 0 ? (
               recentTestsData.map((test) => (
                 <View key={test.id} style={styles.testCard}>
                     <View style={styles.testInfo}>
                       <Text style={styles.testName}>{test.name}</Text>
                       <Text style={styles.testDate}>{test.date}</Text>
                     </View>
                     {/* --- CHANGE THIS LINE TO DISPLAY POINTS --- */}
                     <Text style={styles.testScore}>{test.points} pts</Text>
                     {/* --- END CHANGE --- */}
                 </View>
               ))
            ) : (
                 <Text style={styles.noTestsText}>No recent tests found.</Text>
            )}
         </View>
         {/* --- END UPDATED Section --- */}

      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles --- (Styles remain the same)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', },
  header: { padding: 20, backgroundColor: '#ffffff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e5e5', },
  welcomeText: { fontSize: 16, color: '#6b7280', },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#111827', },
  logoutIcon: { padding: 8, },
  content: { flex: 1, },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 20, marginTop: 20 },
  statCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 20, paddingHorizontal: 10, marginHorizontal: 8, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, minHeight: 120, justifyContent: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginTop: 12, marginBottom: 4 },
  statLabel: { fontSize: 14, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  statLoader: { marginTop: 12, marginBottom: 4 },
  section: { marginBottom: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 12, },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -6, },
  actionButton: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginHorizontal: 6, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, },
  actionButtonText: { fontSize: 14, fontWeight: '500', color: '#374151', marginTop: 8, textAlign: 'center' },
  testCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, },
  testInfo: { flex: 1, marginRight: 10 },
  testName: { fontSize: 16, fontWeight: '500', color: '#1f2937', flexShrink: 1 },
  testDate: { fontSize: 14, color: '#6b7280', marginTop: 4, },
  testScore: { fontSize: 18, fontWeight: '600', color: '#6366f1', }, // Style name kept, but now shows points
  noTestsText: {
      textAlign: 'center',
      marginTop: 20,
      fontSize: 15,
      color: '#6b7280',
  }
});