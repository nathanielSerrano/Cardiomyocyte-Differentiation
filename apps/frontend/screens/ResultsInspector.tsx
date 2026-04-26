import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Switch, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDownloadUrl } from '../services/api';
import { exportPredictionToPDF } from '../services/export'; // NEW IMPORT

export default function ResultsInspector({ navigation, route }) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [imageUrls, setImageUrls] = useState({ raw: null, heatmap: null });
  const [loadingImages, setLoadingImages] = useState(true);
  const [isExporting, setIsExporting] = useState(false); // NEW STATE
  
  const insets = useSafeAreaInsets(); // NEW: Handle bottom screen padding for Pixel 9
  
  // Extract the real prediction object passed from UploadScreen
  const { prediction } = route.params || {};

  useEffect(() => {
    async function fetchImages() {
      if (!prediction) return;
      
      try {
        setLoadingImages(true);
        const rawRes = await getDownloadUrl(prediction.web_image_s3_key);
        const heatmapRes = await getDownloadUrl(prediction.heatmap_image_s3_key);
        
        setImageUrls({
          raw: rawRes.url || rawRes.download_url,
          heatmap: heatmapRes.url || heatmapRes.download_url,
        });
      } catch (err) {
        console.error("Failed to load presigned URLs:", err);
      } finally {
        setLoadingImages(false);
      }
    }

    fetchImages();
  }, [prediction]);

  // NEW: Handle PDF Export
  const handleExport = async () => {
    try {
      setIsExporting(true);
      // We pass the active URLs into the prediction object so the PDF generator can use them
      const predictionWithUrls = {
        ...prediction,
        heatmap_url: imageUrls.heatmap,
        raw_url: imageUrls.raw
      };
      
      await exportPredictionToPDF(predictionWithUrls);
    } catch (error) {
      Alert.alert("Export Failed", "Could not generate the PDF report.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!prediction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No prediction data found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isMature = prediction.confidence > 40; 
  const activeImageUrl = showHeatmap ? imageUrls.heatmap : imageUrls.raw;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analysis Result</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageViewer}>
          {loadingImages || !activeImageUrl ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Decrypting Lab Images...</Text>
            </View>
          ) : (
            <Image 
              source={{ uri: activeImageUrl }} 
              style={styles.mainImage}
              resizeMode="contain"
            />
          )}
          
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Heatmap Overlay</Text>
            <Switch 
              value={showHeatmap} 
              onValueChange={setShowHeatmap}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={showHeatmap ? "#2563EB" : "#F3F4F6"}
              disabled={loadingImages}
            />
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.scoreCard, { borderColor: isMature ? '#10B981' : '#EF4444' }]}>
            <Text style={styles.scoreLabel}>MORPHOLOGY SCORE</Text>
            <Text style={[styles.scoreValue, { color: isMature ? '#10B981' : '#EF4444' }]}>
              {isMature ? 'MATURE' : 'IMMATURE'}
            </Text>
            <Text style={styles.confidenceText}>{prediction.confidence}% Confidence</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Batch ID</Text>
              <Text style={styles.infoDetail}>{prediction.batch_id}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Cell Line</Text>
              <Text style={styles.infoDetail} numberOfLines={1}>{prediction.cell_line}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* NEW: Action Bar with Insets */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={() => navigation.popToTop()} // Safely returns to Home tab
        >
          <Text style={styles.secondaryButtonText}>Done</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={handleExport}
          disabled={isExporting || loadingImages}
        >
          {isExporting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Export PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#6B7280' },
  imageViewer: { width: '100%', height: 400, backgroundColor: '#000', position: 'relative' },
  mainImage: { width: '100%', height: '100%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  loadingText: { color: '#9CA3AF', marginTop: 12, fontWeight: '500' },
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
  
  // NEW: Updated Action Bar Styles
  actionBar: { 
    flexDirection: 'row', padding: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6',
    justifyContent: 'space-between', backgroundColor: 'white',
    paddingTop: 16
  },
  secondaryButton: { 
    padding: 16, borderRadius: 12, width: '30%', 
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6'
  },
  secondaryButtonText: { color: '#374151', fontWeight: 'bold', fontSize: 16 },
  primaryButton: { 
    flexDirection: 'row', backgroundColor: '#2563EB', padding: 16, 
    borderRadius: 12, width: '65%', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4
  },
  primaryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});