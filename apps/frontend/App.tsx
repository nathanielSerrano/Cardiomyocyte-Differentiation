import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  TouchableOpacity, 
  Image,
  FlatList,
  ScrollView, 
  StatusBar,
  Dimensions
} from 'react-native';

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import UploadScreen from './screens/UploadScreen';
import ResultsInspector from './screens/ResultsInspector';

const { width } = Dimensions.get('window');

// --- PLACEMENT FOR NEW SCREENS ---
function HistoryScreen({ navigation }: { navigation: any }) {
  // Mock data for the gallery
  const [history, setHistory] = useState([
    { id: '1', batch_id: '42', cell_line: 'hiPSC-A', outcome: 'Success', confidence: 94, heatmap_url: 'https://images.unsplash.com/photo-1579154235820-213c4c81802d?q=80&w=200' },
    { id: '2', batch_id: '41', cell_line: 'hiPSC-B', outcome: 'Failure', confidence: 12, heatmap_url: 'https://images.unsplash.com/photo-1530210124550-912dc1381cb8?q=80&w=200' },
    { id: '3', batch_id: '40', cell_line: 'hiPSC-A', outcome: 'Success', confidence: 88, heatmap_url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=200' },
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerPadding}>
        <Text style={styles.sectionTitle}>Analysis History</Text>
      </View>
      <FlatList
        data={history}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.historyThumbContainer}
            onPress={() => navigation.navigate('Upload Lab', { 
              screen: 'ResultsInspector', 
              params: { predictionId: item.id } 
            })}
          >
            <Image source={{ uri: item.heatmap_url }} style={styles.historyThumb} />
            <View style={styles.thumbOverlay}>
              <Text style={styles.thumbText}>Batch {item.batch_id}</Text>
              <View style={[styles.statusDot, { backgroundColor: item.outcome === 'Success' ? '#10B981' : '#EF4444' }]} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No history available yet.</Text>}
      />
    </SafeAreaView>
  );
}

function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <View style={styles.centerContainer}>
      <Text style={styles.sectionTitle}>Researcher Profile</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatarLarge}><Text style={styles.avatarTextLarge}>JS</Text></View>
        <Text style={styles.profileName}>Dr. Jane Smith</Text>
        <Text style={styles.profileEmail}>j.smith@cardiolab.org</Text>
      </View>
      <TouchableOpacity style={styles.uploadButton} onPress={onLogout}>
        <Text style={styles.uploadButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator(); // Renamed for clarity
const UploadLabStack = createNativeStackNavigator(); // New stack for Upload Lab tab


// ----------------------
// MAIN APP
// ----------------------
export default function App() {
  const [token, setToken] = useState<string | null>(null);

  return (
    <NavigationContainer>
      {!token ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login">
            {(props) => (
              <LoginScreen 
                {...props} 
                onLogin={setToken} 
                onGoToRegister={() => props.navigation.navigate('Register')} 
              />
            )}
          </AuthStack.Screen>
          <AuthStack.Screen name="Register">
            {(props) => <RegisterScreen {...props} onBack={() => props.navigation.goBack()} />}
          </AuthStack.Screen>
        </AuthStack.Navigator>
      ) : (
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color, size }) => {
              let iconName: any;
              if (route.name === 'Upload Lab') iconName = 'flask';
              else if (route.name === 'History') iconName = 'list';
              else iconName = 'person';
              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#2563EB',
            tabBarInactiveTintColor: 'gray',
            headerShown: false,
          })}
        >
          {/* Upload Lab Tab now contains its own stack */}
          <Tab.Screen name="Upload Lab" options={{ headerShown: false }}>
            {() => (
              <UploadLabStack.Navigator screenOptions={{ headerShown: false }}>
                {/* Pass token to HomeScreen as initialParams */}
                <UploadLabStack.Screen name="Home" component={HomeScreen} initialParams={{ token: token }} />
                <UploadLabStack.Screen name="Upload" component={UploadScreen} initialParams={{ token: token }} />
                <UploadLabStack.Screen name="ResultsInspector" component={ResultsInspector} />
              </UploadLabStack.Navigator>
            )}
          </Tab.Screen>
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Profile">
            {(props) => <ProfileScreen {...props} onLogout={() => setToken(null)} />}
          </Tab.Screen>
        </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}

// ----------------------
// HOME SCREEN (your UI)
// ----------------------
function HomeScreen({ navigation, route }: { navigation: any; route: any }) {
  const token = route.params?.token; 
  const [recentPrediction, setRecentPrediction] = useState<any>(null);
  useEffect(() => {
    const fetchRecentPrediction = async () => {
      try {
        // Replace with your actual API call to get recent predictions
        // For now, using a mock to demonstrate structure
        const mockPrediction = {
          id: 1,
          batch_id: "Batch #42",
          cell_line: "hiPSC-CM Line A",
          outcome: "Success",
          confidence: 94.5,
          heatmap_url: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=500&q=60",
        };
        setRecentPrediction(mockPrediction);
      } catch (error) {
        console.error("Failed to fetch recent prediction:", error);
      }
    };
    fetchRecentPrediction();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, Researcher</Text>
            <Text style={styles.title}>CardioPredict</Text>
          </View>
        </View>

        {/* UPLOAD BUTTON */}
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={() => navigation.navigate('Upload')} // Navigate to UploadScreen within the UploadLabStack
        >
          <Text style={styles.uploadButtonText}>+ Upload Day 7 Images</Text>
          <Text style={styles.uploadSubtitle}>Supports .ome.tiff files</Text>
        </TouchableOpacity>

        {/* RECENT RESULTS */}
        <Text style={styles.sectionTitle}>Recent Analyses</Text>
        {recentPrediction ? (
          <TouchableOpacity onPress={() => navigation.navigate('ResultsInspector', { predictionId: recentPrediction.id })}>
            <PredictionCard prediction={recentPrediction} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.emptyText}>No recent analyses found. Upload a file to begin.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Reusable card component for the History and Home tab
function PredictionCard({ prediction }: { prediction: any }) {
  return (
    <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.batchId}>Batch {prediction.batch_id}</Text>
            <Text style={styles.dateText}>Today</Text>
          </View>

          <Text style={styles.cellLineText}>{prediction.cell_line}</Text>

          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: prediction.heatmap_url }} 
              style={styles.heatmapImage}
            />

            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>
                {prediction.outcome.toUpperCase()}
              </Text>
            </View>

            <View style={styles.confidenceOverlay}>
              <Text style={styles.confidenceLabel}>Confidence</Text>
              <Text style={styles.confidenceValue}>
                {prediction.confidence}%
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => alert("Exporting to Electronic Lab Notebook...")}
          >
            <Text style={styles.secondaryButtonText}>Export to Lab Notebook</Text>
          </TouchableOpacity>
        </View>
  );
}

// ----------------------
// STYLES (unchanged)
// ----------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  headerPadding: {
    padding: 20,
  },
  greeting: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  uploadButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 15,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  batchId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
  },
  cellLineText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  heatmapImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#E5E7EB',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
  },
  // New Gallery & Profile Styles
  historyThumbContainer: {
    width: (width - 40) / 2,
    height: (width - 40) / 2,
    margin: 5,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  historyThumb: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thumbText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  profileCard: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
    marginBottom: 40,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarTextLarge: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  confidenceOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceLabel: {
    fontSize: 8,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
});