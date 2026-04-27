import React, { useState, useCallback, useEffect } from 'react';
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
  
  // Pagination State
  const [initialLoad, setInitialLoad] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true); 

  // We assume your limit per page is 20. Adjust this to match your backend!
  const PAGE_LIMIT = 20;

  const fetchHistory = async (pageNumber: number, isInitial = false) => {
    if (!hasMore && !isInitial) return;

    try {
      if (!isInitial) setLoadingMore(true);

      // Pass the page to your API service (you'll need to update getPredictions to accept this)
      const predictions = await getPredictions(token, pageNumber, PAGE_LIMIT);
      
      if (predictions && predictions.length > 0) {
        if (isInitial) {
          setHistory(predictions);
        } else {
          // Append new data to the bottom of the list
          setHistory(prev => [...prev, ...predictions]);
        }
        
        // If the backend returns fewer items than our limit, we've hit the end of the database
        if (predictions.length < PAGE_LIMIT) {
          setHasMore(false);
        }
      } else {
        setHasMore(false); // No data returned
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setInitialLoad(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Reset state and fetch page 1 whenever the screen comes into focus
      setPage(1);
      setHasMore(true);
      fetchHistory(1, true);
    }, [token])
  );

  // Triggered by FlatList when user scrolls near the bottom
  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !initialLoad) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchHistory(nextPage);
    }
  };

  // Renders a spinner at the very bottom of the list while fetching the next page
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="small" color="#2563EB" />
      </View>
    );
  };

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
          
          // --- NEW PAGINATION PROPS ---
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5} // 0.5 means it triggers when the user is halfway down the final screen of content
          ListFooterComponent={renderFooter}
          // ----------------------------

          renderItem={({ item }) => (
            <HistoryThumb 
              item={item} 
              token={token}
              onPress={() => navigation.navigate('Upload Lab', { 
                screen: 'ResultsInspector', 
                params: { prediction: item, token: token } 
              })}
            />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No history available yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}
// ----------------------
// HISTORY THUMB COMPONENT
// ----------------------
function HistoryThumb({ item, token, onPress }: { item: any, token: string, onPress: () => void }) {
  const s3Key = item.heatmap_image_s3_key;
  // Initialize with cache if we have it, otherwise null
  const [imageUrl, setImageUrl] = useState<string | null>(urlCache.get(s3Key) || null);

  useEffect(() => {
    let isActive = true;

    const fetchUrl = async () => {
      // If we don't have it in the cache, fetch it now
      if (!imageUrl && s3Key) {
        try {
          const res = await getDownloadUrl(s3Key);
          const finalUrl = res.url || res.download_url;
          
          urlCache.set(s3Key, finalUrl); // Save to cache
          
          if (isActive) {
            setImageUrl(finalUrl);
          }
        } catch (error) {
          console.error("Failed to fetch image URL for", s3Key);
        }
      }
    };

    fetchUrl();
    return () => { isActive = false; };
  }, [s3Key]);

  return (
    <TouchableOpacity style={styles.historyThumbContainer} onPress={onPress}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.historyThumb} />
      ) : (
        <View style={[styles.historyThumb, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color="#9CA3AF" />
        </View>
      )}
      <View style={styles.thumbOverlay}>
        <Text style={styles.thumbText}>Batch {item.batch_id}</Text>
        <View style={[styles.statusDot, { backgroundColor: item.outcome === 'Success' ? '#10B981' : '#EF4444' }]} />
      </View>
    </TouchableOpacity>
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
            // Set the latest prediction immediately without waiting for the image URL
            if (isActive) setRecentPrediction(predictions[0]);
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
  const s3Key = prediction.heatmap_image_s3_key;
  const [imageUrl, setImageUrl] = useState<string | null>(urlCache.get(s3Key) || null);

  useEffect(() => {
    let isActive = true;

    const fetchUrl = async () => {
      // Fetch if not in cache
      if (!imageUrl && s3Key) {
        try {
          const res = await getDownloadUrl(s3Key);
          const finalUrl = res.url || res.download_url;
          urlCache.set(s3Key, finalUrl);
          
          if (isActive) {
            setImageUrl(finalUrl);
          }
        } catch (error) {
          console.error("Failed to fetch image URL for PredictionCard", error);
        }
      }
    };

    fetchUrl();
    return () => { isActive = false; };
  }, [s3Key]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.batchId}>Batch {prediction.batch_id}</Text>
        <Text style={styles.dateText}>Latest</Text>
      </View>

      <Text style={styles.cellLineText}>{prediction.cell_line}</Text>

      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image 
            source={{ uri: imageUrl }} 
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
            // If exportPredictionToPDF requires the URL, you might need to pass it in!
            await exportPredictionToPDF({ ...prediction, heatmap_url: imageUrl });
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