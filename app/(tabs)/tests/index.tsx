import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Timer, Heart, Dumbbell, Ruler, Scale, Activity } from 'lucide-react-native';

const testCategories = [
  {
    id: 'cardio',
    title: 'Cardiovascular Tests',
    icon: Heart,
    tests: [
      { id: 'queens', name: "Queen's College Step Test", points: 100 },
      { id: 'beep', name: '20m Shuttle Run (Beep Test)', points: 100 },
      { id: '1-6km', name: '1.6km Run Test', points: 100 },
      { id: '400m', name: '400m Run Test', points: 50 },
      { id: '800m', name: '800m Run Test', points: 75 },
    ],
  },
  {
    id: 'strength',
    title: 'Strength & Endurance',
    icon: Dumbbell,
    tests: [
      { id: 'squat', name: 'Squat Test', points: 50 },
      { id: 'pullup', name: 'Pull-Up Test', points: 50 },
      { id: 'pushup', name: 'Push-Up Test', points: 50 },
    ],
  },
  {
    id: 'flexibility',
    title: 'Flexibility Tests',
    icon: Activity,
    tests: [
      { id: 'sitreach', name: 'Sit and Reach Test', points: 30 },
      { id: 'trunk', name: 'Trunk Rotation Test', points: 30 },
      { id: 'shoulder', name: 'Shoulder Elevation Test', points: 30 },
    ],
  },
  {
    id: 'other',
    title: 'Other Assessments',
    icon: Scale,
    tests: [
      { id: 'bmi', name: 'Body Mass Index (BMI)', points: 20 },
      { id: 'illinois', name: 'Illinois Agility Test', points: 75 },
      { id: 'vertical', name: 'Vertical Jump Test', points: 50 },
      { id: 'longjump', name: 'Standing Long Jump', points: 50 },
      { id: '50m', name: '50 Metre Sprint', points: 50 },
      { id: 'stork', name: 'Stork Balance Test', points: 30 },
    ],
  },
];

export default function TestsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fitness Tests</Text>
        <Text style={styles.subtitle}>Choose a test to begin</Text>
      </View>

      <ScrollView style={styles.content}>
        {testCategories.map((category) => (
          <View key={category.id} style={styles.category}>
            <View style={styles.categoryHeader}>
              <category.icon size={24} color="#6366f1" />
              <Text style={styles.categoryTitle}>{category.title}</Text>
            </View>
            {category.tests.map((test) => (
              <Link
                key={test.id}
                href={{
                  pathname: '/tests/[id]',
                  params: { id: test.id },
                }}
                asChild>
                <TouchableOpacity style={styles.testCard}>
                  <View>
                    <Text style={styles.testName}>{test.name}</Text>
                    <Text style={styles.testPoints}>+{test.points} points</Text>
                  </View>
                  <Timer size={20} color="#6b7280" />
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  category: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  testCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  testName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  testPoints: {
    fontSize: 14,
    color: '#6366f1',
    marginTop: 4,
  },
});