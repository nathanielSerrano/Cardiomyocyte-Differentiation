import { useState } from "react";
import { View, TouchableOpacity, Text, ActivityIndicator, FlatList, StyleSheet, SafeAreaView } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { getUploadUrl, createPrediction, getDownloadUrl } from "../services/api";

export default function UploadScreen({ navigation, route }) {
  const { token } = route.params;
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["image/tiff", "application/octet-stream"], // OME-TIFF often appears as octet-stream
      copyToCacheDirectory: true,
    });

    if (!res.canceled) {
      setQueue((prev) => [...prev, ...res.assets]);
    }
  };

  const handleAnalyze = async () => {
    if (queue.length === 0) return;

    try {
      setLoading(true);
      const currentFile = queue[0];
      const s3Key = `uploads/${Date.now()}_${currentFile.name}`;

      const { upload_url } = await getUploadUrl(s3Key);
      const file = await fetch(currentFile.uri);
      const blob = await file.blob();

      await fetch(upload_url, {
        method: "PUT",
        body: blob,
      });

      const prediction = await createPrediction(token, {
        project_id: "1",
        batch_id: "batch_001",
        cell_line: currentFile.name.substring(0, 10),
        original_image_s3_key: s3Key,
      });

      // Clear queue and go to Results
      setQueue([]);
      navigation.navigate("ResultsInspector", { predictionId: prediction.id });
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const removeFromQueue = (uri: string) => {
    setQueue(queue.filter(item => item.uri !== uri));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Upload Lab</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.dropZone}>
        <Ionicons name="cloud-upload-outline" size={48} color="#2563EB" />
        <Text style={styles.dropText}>Select OME.TIFF files for analysis</Text>
        <TouchableOpacity style={styles.pickButton} onPress={pickDocument}>
          <Text style={styles.pickButtonText}>Browse Files</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Pending Queue ({queue.length})</Text>
      <FlatList
        data={queue}
        keyExtractor={(item) => item.uri}
        renderItem={({ item }) => (
          <View style={styles.queueItem}>
            <Ionicons name="document-text-outline" size={24} color="#6B7280" />
            <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
            <TouchableOpacity onPress={() => removeFromQueue(item.uri)}>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No files in queue.</Text>}
      />

      <TouchableOpacity 
        style={[styles.analyzeButton, (queue.length === 0 || loading) && styles.disabledButton]} 
        onPress={handleAnalyze}
        disabled={queue.length === 0 || loading}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.analyzeButtonText}>Run GPU Analysis</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 20 },
  title: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  dropZone: {
    height: 200,
    borderWidth: 2,
    borderColor: "#DBEAFE",
    borderStyle: "dashed",
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  dropText: { color: "#1E40AF", marginTop: 10, marginBottom: 20 },
  pickButton: { backgroundColor: "#2563EB", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  pickButtonText: { color: "white", fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#374151", marginBottom: 10 },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  fileName: { flex: 1, marginLeft: 10, color: "#4B5563" },
  analyzeButton: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 20,
  },
  analyzeButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  disabledButton: { backgroundColor: "#93C5FD" },
  emptyText: { textAlign: "center", color: "#9CA3AF", marginTop: 20 }
});