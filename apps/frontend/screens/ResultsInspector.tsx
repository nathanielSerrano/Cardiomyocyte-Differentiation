import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Switch, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ResultsInspector({ navigation, route }) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const { predictionId } = route.params || {};
  
  // Mock data representing what the API returns
  const result = {
    outcome: "Success",
    confidence: 94.2,
    raw_url: "https://images.unsplash.com/photo-1530210124550-912dc1381cb8?q=80&w=800", // Biological Raw
    heatmap_url: "https://images.unsplash.com/photo-1579154235820-213c4c81802d?q=80&w=800", // Blended Heatmap
  };

  const isMature = result.confidence > 30; // Per documentation threshold

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analysis Result</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView>
        <View style={styles.imageViewer}>
          <Image 
            source={{ uri: showHeatmap ? result.heatmap_url : result.raw_url }} 
            style={styles.mainImage}
            resizeMode="contain"
          />
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Heatmap Overlay</Text>
            <Switch 
              value={showHeatmap} 
              onValueChange={setShowHeatmap}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={showHeatmap ? "#2563EB" : "#F3F4F6"}
            />
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.scoreCard, { borderColor: isMature ? '#10B981' : '#EF4444' }]}>
            <Text style={styles.scoreLabel}>MORPHOLOGY SCORE</Text>
            <Text style={[styles.scoreValue, { color: isMature ? '#10B981' : '#EF4444' }]}>
              {isMature ? 'MATURE' : 'IMMATURE'}
            </Text>
            <Text style={styles.confidenceText}>{result.confidence}% Confidence</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Batch ID</Text>
              <Text style={styles.infoDetail}>#001-A</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Cell Line</Text>
              <Text style={styles.infoDetail}>hiPSC-CM</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.discardButton} onPress={() => navigation.goBack()}>
          <Text style={styles.discardText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={() => navigation.popToTop()}>
          <Text style={styles.saveText}>Save to History</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  imageViewer: { width: '100%', height: 400, backgroundColor: '#000', position: 'relative' },
  mainImage: { width: '100%', height: '100%' },
  toggleContainer: { 
    position: 'absolute', bottom: 20, right: 20, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    padding: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center' 
  },
  toggleLabel: { fontSize: 12, fontWeight: '600', marginRight: 10, color: '#374151' },
  content: { padding: 20 },
  scoreCard: { 
    borderWidth: 2, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20,
    backgroundColor: '#F9FAFB' 
  },
  scoreLabel: { fontSize: 12, color: '#6B7280', fontWeight: 'bold', letterSpacing: 1 },
  scoreValue: { fontSize: 32, fontWeight: '900', marginVertical: 4 },
  confidenceText: { fontSize: 16, color: '#374151', fontWeight: '500' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoBox: { backgroundColor: '#F3F4F6', padding: 15, borderRadius: 12, width: '48%' },
  infoTitle: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 },
  infoDetail: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  actionBar: { 
    flexDirection: 'row', padding: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6',
    justifyContent: 'space-between'
  },
  discardButton: { padding: 16, borderRadius: 12, width: '30%', alignItems: 'center' },
  discardText: { color: '#EF4444', fontWeight: 'bold' },
  saveButton: { 
    backgroundColor: '#2563EB', padding: 16, borderRadius: 12, width: '65%', 
    alignItems: 'center', shadowColor: '#2563EB', shadowOpacity: 0.2, shadowRadius: 10 
  },
  saveText: { color: 'white', fontWeight: 'bold' }
});