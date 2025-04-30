// app/(tabs)/_layout.tsx - ADDED History Tab

import { Tabs } from 'expo-router';
import { Trophy, ClipboardCheck, Home, Settings, MessageCircle, History } from 'lucide-react-native'; // Added History icon

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // ... your existing screenOptions ...
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e5e5',
          height: 60,
          paddingBottom: 5,
          paddingTop: 5,
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        headerShown: false,
        tabBarLabelStyle: {
            fontSize: 12,
        },
      }}>

      <Tabs.Screen
        name="dashboard" // Points to app/(tabs)/dashboard.tsx
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tests" // Points to app/(tabs)/tests/index.tsx
        options={{
          title: 'Tests',
          tabBarIcon: ({ color, size }) => <ClipboardCheck size={size} color={color} />,
        }}
      />
      {/* --- ADDED HISTORY TAB --- */}
      <Tabs.Screen
        name="history" // Points to app/(tabs)/history.tsx
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      {/* --- END HISTORY TAB --- */}
      <Tabs.Screen
        name="leaderboard" // Points to app/(tabs)/leaderboard.tsx
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="settings" // Points to app/(tabs)/settings.tsx
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}