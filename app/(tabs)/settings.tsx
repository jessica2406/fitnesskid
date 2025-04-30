// app/(tabs)/settings.tsx - Merged with FAQ Section

import React, { useState, useCallback } from 'react'; // Added useState, useCallback
import {
    View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Settings as SettingsIcon, Bell, User, LogOut,
    ChevronDown, ChevronUp // Added FAQ icons
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

// --- FAQ Data --- (Moved inside or imported if preferred)
const faqData = [
    {
        question: 'How is my total score calculated?',
        answer: 'Your total score is the sum of points awarded for each fitness test you have completed and saved in your history.',
    },
    {
        question: 'How often should I take the tests?',
        answer: 'Consult with your PE teacher or coach for the recommended testing frequency. Generally, testing might occur once per term or semester.',
    },
    {
        question: 'Can I delete a test result?',
        answer: 'Yes, you can delete individual test results from the "History" tab by tapping the trash icon next to the entry.',
    },
    {
        question: 'How are leaderboard rankings determined?',
        answer: 'Rankings are based on the "Total Points" shown on your dashboard. Higher points mean a higher rank within the selected filter (Overall or Class).',
    },
    {
        question: 'Where do the test norms come from?',
        answer: 'The rating norms used in the tests are based on standard fitness testing protocols and data. Please note they are for general guidance.',
    },
    // Add more questions and answers here
];
// ----------------

export default function SettingsScreen() {
  const { user, logout, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState(true);
  // const [darkMode, setDarkMode] = useState(false); // Removed if not used

  // --- State for FAQ expansion ---
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  const toggleFaq = useCallback((index: number) => {
      setExpandedFaqIndex(prevIndex => (prevIndex === index ? null : index));
  }, []); // useCallback to prevent unnecessary re-renders if passed down

  const handleLogout = async () => {
      console.log("!!! handleLogout in SettingsScreen called !!!");
      Alert.alert(
          "Confirm Logout",
          "Are you sure you want to log out?",
          [
              { text: "Cancel", style: "cancel" },
              {
                  text: "Logout",
                  style: "destructive",
                  onPress: async () => {
                      console.log("!!! Alert 'Logout' button PRESSED - Calling context logout !!!");
                      try {
                          await logout();
                      } catch (e) {
                          console.error("Logout failed on settings screen (inside alert onPress):", e);
                      }
                  }
              }
          ]
      );
  };

  // Helper to render profile details
  const renderProfileDetails = () => {
      if (authLoading && !user) {
          return <ActivityIndicator style={styles.profileInfoContainer} />;
      }
      if (user) {
          return (
              <View style={styles.profileInfoContainer}>
                  <Text style={styles.profileName}>{user.name || 'N/A'}</Text>
                  <Text style={styles.profileDetail}>Class: {user.class || 'N/A'}</Text>
                  <Text style={styles.profileDetail}>Reg No: {user.RegisterNo || 'N/A'}</Text>
                  <Text style={styles.profileDetail}>Email: {user.email || 'N/A'}</Text>
              </View>
          );
      }
      return <Text style={styles.settingText}>Profile not loaded</Text>;
  };


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <SettingsIcon size={24} color="#6366f1" />
      </View>

      <ScrollView style={styles.content}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <User size={24} color="#4b5563" style={{marginRight: 16}} /> {/* Added marginRight to icon */}
              {renderProfileDetails()}
            </View>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Bell size={20} color="#4b5563" style={{marginRight: 16}}/> {/* Added marginRight to icon */}
              <Text style={styles.settingText}>Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#d1d5db', true: '#818cf8' }}
              thumbColor={notifications ? '#6366f1' : '#f3f4f6'}
            />
          </View>
          {/* Add Dark Mode switch here if needed, similar to Notifications */}
        </View>

        {/* --- FAQ Section --- */}
        <View style={styles.faqSection}> {/* Use different style name if needed */}
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            {faqData.map((faq, index) => (
                <View key={index} style={styles.faqItemContainer}>
                    <TouchableOpacity
                        style={styles.faqQuestionTouchable}
                        onPress={() => toggleFaq(index)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.faqQuestionText}>{faq.question}</Text>
                        {expandedFaqIndex === index
                            ? <ChevronUp size={20} color="#6b7280" />
                            : <ChevronDown size={20} color="#6b7280" />
                        }
                    </TouchableOpacity>
                    {expandedFaqIndex === index && (
                        <View style={styles.faqAnswerContainer}>
                             <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                        </View>
                    )}
                </View>
            ))}
        </View>
        {/* --- End FAQ Section --- */}

        {/* App Version Footer */}
         <Text style={styles.footerText}>App Version 1.0.0</Text>

      </ScrollView>

      {/* Logout Button Area - Kept at bottom */}
      <View style={styles.logoutContainer}>
           <TouchableOpacity
             style={[styles.logoutButton, authLoading && styles.buttonDisabled]}
             onPress={handleLogout}
             disabled={authLoading}
           >
              {authLoading ? (
                  <ActivityIndicator color="#ffffff" />
               ) : (
                   <>
                      <LogOut size={18} color="#ffffff" style={{marginRight: 8}} />
                      <Text style={styles.logoutText}>Log Out</Text>
                   </>
               )}
           </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- Styles --- (Merge new styles with existing)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    paddingHorizontal: 20, // Apply padding here for ScrollView content
    paddingBottom: 30, // Add padding at bottom if needed
  },
  section: { // Style for Account/Preferences cards
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 8, // Adjusted padding
    paddingHorizontal: 16,
    marginBottom: 20, // Spacing between sections
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    paddingHorizontal: 4, // Add slight padding if title is outside the items
    paddingTop: 12, // Add padding if title is inside the section card
  },
  settingItem: {
    // Removed background color here, handled by section
    paddingVertical: 12,
    // paddingHorizontal: 16, // Handled by section
    // marginBottom: 10, // Use padding/margin on section instead
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    borderBottomWidth: 1, // Optional separator line inside section card
    borderBottomColor: '#f3f4f6',
  },
  settingItemLast: { // Style to remove border from last item in section
      borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Take available space
  },
  settingText: {
    fontSize: 16,
    color: '#374151', // Darker text for readability
    // Removed marginLeft, rely on icon margin
  },
  profileInfoContainer: {
    // marginLeft: 16, // Handled by icon margin
    flexShrink: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  profileDetail: {
      fontSize: 14,
      color: '#6b7280',
      marginTop: 3,
  },
  logoutContainer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: '#e5e5e5',
      backgroundColor: '#ffffff', // White background for logout button area
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
   buttonDisabled: {
      backgroundColor: '#fca5a5',
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // --- FAQ Styles ---
  faqSection: { // Similar style to other sections
      backgroundColor: '#ffffff',
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginBottom: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
  },
  faqItemContainer: {
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6', // Lighter separator for FAQ items
      // paddingVertical: 12, // Padding handled by touchable/answer container
      // No background needed here
  },
  faqQuestionTouchable: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14, // Decent touch area
  },
  faqQuestionText: {
      fontSize: 16,
      fontWeight: '500',
      color: '#374151',
      flex: 1, // Allow text to wrap
      marginRight: 10,
  },
  faqAnswerContainer: {
      paddingBottom: 16, // Space below answer
      paddingLeft: 5, // Slight indent
      paddingRight: 5,
  },
  faqAnswerText: {
      fontSize: 15,
      color: '#4b5563',
      lineHeight: 22,
  },
  footerText: {
       textAlign: 'center',
       marginTop: 10, // Reduced margin now inside scrollview padding
       marginBottom: 20,
       color: '#9ca3af',
       fontSize: 12,
  }
});