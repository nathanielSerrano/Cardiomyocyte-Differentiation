import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Image,
  FlatList,
  ScrollView, 
  StatusBar,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import UploadScreen from './screens/UploadScreen';
import ResultsInspector from './screens/ResultsInspector';
import ProfileScreen from './screens/ProfileScreen';

import { getPredictions, getDownloadUrl } from './services/api';
import { exportPredictionToPDF } from './services/export';
const urlCache = new Map<string, string>();

const { width } = Dimensions.get('window');

// ----------------------
// HISTORY SCREEN
// ----------------------
function HistoryScreen({ navigation, route }: { navigation: any, route: any }) {
  const token = route.params?.token;
  const [history, setHistory] = useState<any[]>([]);
  const [initialLoad, setInitialLoad] = useState(true); // Only show spinner on first load

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchHistory = async () => {
        try {
          const predictions = await getPredictions(token);
          
          // Fast-map S3 keys using our memory cache
          const historyWithUrls = await Promise.all(
            predictions.map(async (p: any) => {
              try {
                const s3Key = p.heatmap_image_s3_key;
                
                // 1. Return instantly if we already fetched this URL recently!
                if (urlCache.has(s3Key)) {
                  return { ...p, heatmap_url: urlCache.get(s3Key) };
                }
                
                // 2. Otherwise, fetch it and save it to the cache
                const res = await getDownloadUrl(s3Key);
                const finalUrl = res.url || res.download_url;
                urlCache.set(s3Key, finalUrl);
                
                return { ...p, heatmap_url: finalUrl };
              } catch (e) {
                return p;
              }
            })
          );

          if (isActive) {
            setHistory(historyWithUrls); // Removed the .reverse() since backend is already DESC
            setInitialLoad(false);
          }
        } catch (error) {
          console.error("Failed to fetch history:", error);
          if (isActive) setInitialLoad(false);
        }
      };

      fetchHistory();
      return () => { isActive = false; };
    }, [token])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerPadding}>
        <Text style={styles.sectionTitle}>Analysis History</Text>
      </View>
      
      {initialLoad ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={history}
          numColumns={2}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.historyThumbContainer}
              onPress={() => navigation.navigate('Upload Lab', { 
                screen: 'ResultsInspector', 
                params: { prediction: item, token: token } 
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
      )}
    </SafeAreaView>
  );
}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const UploadLabStack = createNativeStackNavigator();


// ----------------------
// MAIN APP
// ----------------------
export default function App() {
  const [token, setToken] = useState<string | null>(null);

  return (
    <SafeAreaProvider>
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
          <Tab.Screen name="Upload Lab">
            {() => (
              <UploadLabStack.Navigator screenOptions={{ headerShown: false }}>
                <UploadLabStack.Screen name="Home" component={HomeScreen} initialParams={{ token: token }} />
                <UploadLabStack.Screen name="Upload" component={UploadScreen} initialParams={{ token: token }} />
                <UploadLabStack.Screen name="ResultsInspector" component={ResultsInspector} />
              </UploadLabStack.Navigator>
            )}
          </Tab.Screen>
          {/* Passed the token down to History Screen */}
          <Tab.Screen name="History" component={HistoryScreen} initialParams={{ token: token }} />
          <Tab.Screen name="Profile">
            {(props) => <ProfileScreen {...props} token={token} onLogout={() => setToken(null)} />}
          </Tab.Screen>
        </Tab.Navigator>
      )}
    </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ----------------------
// HOME SCREEN
// ----------------------
function HomeScreen({ navigation, route }: { navigation: any; route: any }) {
  const token = route.params?.token; 
  const [recentPrediction, setRecentPrediction] = useState<any>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchRecentPrediction = async () => {
        try {
          const predictions = await getPredictions(token);
          
          if (predictions && predictions.length > 0) {
            // THE FIX: The backend already sorts by newest first! Index 0 is the newest.
            const latest = predictions[0]; 
            const s3Key = latest.heatmap_image_s3_key;
            let finalUrl = urlCache.get(s3Key);
            
            // Only hit the backend if it's not in our cache
            if (!finalUrl) {
                const res = await getDownloadUrl(s3Key);
                finalUrl = res.url || res.download_url;
                urlCache.set(s3Key, finalUrl);
            }
            
            if (isActive) {
              setRecentPrediction({ ...latest, heatmap_url: finalUrl });
            }
          } else {
            if (isActive) setRecentPrediction(null);
          }
        } catch (error) {
          console.error("Failed to fetch recent prediction:", error);
        } finally {
          if (isActive) setInitialLoad(false);
        }
      };

      fetchRecentPrediction();
      return () => { isActive = false; };
    }, [token])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, Researcher</Text>
            <Text style={styles.title}>MyoScope</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={() => navigation.navigate('Upload')} 
        >
          <Text style={styles.uploadButtonText}>+ Upload Day 7 Images</Text>
          <Text style={styles.uploadSubtitle}>Supports .ome.tiff files</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Most Recent Analysis</Text>
        
        {initialLoad ? (
          <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 20 }} />
        ) : recentPrediction ? (
          <TouchableOpacity onPress={() => navigation.navigate('ResultsInspector', { prediction: recentPrediction, token: token })}>
            <PredictionCard prediction={recentPrediction} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.emptyText}>No recent analyses found. Upload a file to begin.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ----------------------
// PREDICTION CARD 
// ----------------------
function PredictionCard({ prediction }: { prediction: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.batchId}>Batch {prediction.batch_id}</Text>
        <Text style={styles.dateText}>Latest</Text>
      </View>

      <Text style={styles.cellLineText}>{prediction.cell_line}</Text>

      <View style={styles.imageContainer}>
        {prediction.heatmap_url ? (
          <Image 
            source={{ uri: prediction.heatmap_url }} 
            style={styles.heatmapImage}
          />
        ) : (
          <View style={[styles.heatmapImage, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator color="#2563EB" />
          </View>
        )}

        <View style={[styles.badgeContainer, { backgroundColor: prediction.outcome === 'Success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)' }]}>
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
        onPress={async () => {
          try {
            await exportPredictionToPDF(prediction);
          } catch (e) {
            alert("Failed to create PDF report.");
          }
        }}
      >
        <Text style={styles.secondaryButtonText}>Export to Lab Notebook</Text>
      </TouchableOpacity>
    </View>
  );
}

// ----------------------
// STYLES
// ----------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: 10 },
  headerPadding: { padding: 20 },
  greeting: { fontSize: 16, color: '#6B7280', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  uploadButton: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 30, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  uploadButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  uploadSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 15 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  batchId: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  dateText: { fontSize: 14, color: '#6B7280' },
  cellLineText: { fontSize: 14, color: '#4B5563', marginBottom: 16 },
  imageContainer: { position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  heatmapImage: { width: '100%', height: 200, backgroundColor: '#E5E7EB' },
  badgeContainer: { position: 'absolute', bottom: 12, right: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  secondaryButton: { backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  secondaryButtonText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', marginTop: 20 },
  historyThumbContainer: { width: (width - 40) / 2, height: (width - 40) / 2, margin: 5, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  historyThumb: { width: '100%', height: '100%' },
  thumbOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thumbText: { color: 'white', fontSize: 10, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  profileCard: { backgroundColor: 'white', padding: 30, borderRadius: 20, alignItems: 'center', width: '80%', marginBottom: 40 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarTextLarge: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  profileEmail: { fontSize: 14, color: '#6B7280' },
  confidenceOverlay: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255, 255, 255, 0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  confidenceLabel: { fontSize: 8, color: '#6B7280', textTransform: 'uppercase' },
  confidenceValue: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
});