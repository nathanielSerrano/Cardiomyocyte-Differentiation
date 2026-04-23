import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  StatusBar 
} from 'react-native';

import LoginScreen from './screens/loginscreen';
import UploadScreen from './screens/uploadscreen';

// --- MOCK DATA (keep for now) ---
const mockRecentBatch = {
  id: "Batch #42",
  cellLine: "hiPSC-CM Line A",
  status: "Analysis Complete",
  prediction: "Success",
  confidence: 94.5,
  heatmapUrl: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=500&q=60", 
  date: "Today, 10:42 AM"
};

// ----------------------
// MAIN APP
// ----------------------
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<"home" | "upload">("home");

  // 🔐 Not logged in → show login
  if (!token) {
    return <LoginScreen onLogin={setToken} />;
  }

  // 📤 Upload screen
  if (screen === "upload") {
    return (
      <UploadScreen 
        token={token} 
        onBack={() => setScreen("home")} 
      />
    );
  }

  // 🏠 Home screen
  return (
    <HomeScreen 
      token={token} 
      onUpload={() => setScreen("upload")} 
    />
  );
}

// ----------------------
// HOME SCREEN (your UI)
// ----------------------
function HomeScreen({ token, onUpload }: { token: string; onUpload: () => void }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, Dr. Smith</Text>
            <Text style={styles.title}>CardioPredict</Text>
          </View>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>DS</Text>
          </View>
        </View>

        {/* UPLOAD BUTTON */}
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={onUpload}
        >
          <Text style={styles.uploadButtonText}>+ Upload Day 7 Images</Text>
        </TouchableOpacity>

        {/* RECENT RESULTS */}
        <Text style={styles.sectionTitle}>Recent Analyses</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.batchId}>{mockRecentBatch.id}</Text>
            <Text style={styles.dateText}>{mockRecentBatch.date}</Text>
          </View>

          <Text style={styles.cellLineText}>{mockRecentBatch.cellLine}</Text>

          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: mockRecentBatch.heatmapUrl }} 
              style={styles.heatmapImage}
            />

            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>
                {mockRecentBatch.prediction} ({mockRecentBatch.confidence}%)
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

      </ScrollView>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
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
  avatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
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
  }
});