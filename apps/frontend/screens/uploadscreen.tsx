import { useState, useEffect } from "react";
import { 
  View, 
  TouchableOpacity, 
  Text, 
  TextInput, 
  ActivityIndicator, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  ScrollView, 
  Platform 
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { getUploadUrl, createPrediction, getUserInfo } from "../services/api";
import ReactNativeBlobUtil from 'react-native-blob-util';

export default function UploadScreen({ navigation, route }: any) {
  const { token } = route.params;
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Metadata State
  const [batchId, setBatchId] = useState("");
  const [cellLine, setCellLine] = useState("");
  
  // New: Project ID State
  const [projectId, setProjectId] = useState<string | null>(null);

  // New: Silently fetch the user's project ID in the background
  useEffect(() => {
    let isActive = true;
    const fetchProjectData = async () => {
      try {
        const data = await getUserInfo(token);
        // Uses the exact response format from your new /user-info route
        if (isActive && data.projects && data.projects.length > 0) {
          setProjectId(data.projects[0].id.toString()); 
        }
      } catch (err) {
        console.error("Failed to load project context:", err);
      }
    };
    fetchProjectData();
    return () => { isActive = false; };
  }, [token]);

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["image/tiff", "application/octet-stream"],
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

      // 1. Get the presigned URL from your FastAPI backend
      const { upload_url } = await getUploadUrl(s3Key);

      // 2. The "Nuclear Fix": Stream raw bytes directly to S3
      const uploadResult = await ReactNativeBlobUtil.fetch('PUT', upload_url, {
        'Content-Type': 'application/octet-stream',
      }, ReactNativeBlobUtil.wrap(currentFile.uri));

      if (uploadResult.respInfo.status !== 200) {
        throw new Error(`S3 Upload failed with status ${uploadResult.respInfo.status}`);
      }

      // 3. Trigger prediction using the dynamic projectId and custom inputs
      const prediction = await createPrediction(token, {
        project_id: projectId || "1", // Fallback to "1" just in case
        batch_id: batchId.trim() !== "" ? batchId : "Uncategorized",
        cell_line: cellLine.trim() !== "" ? cellLine : currentFile.name.substring(0, 10),
        original_image_s3_key: s3Key,
      });

      // 4. Success: Clear queue, clear inputs, and navigate to results
      setQueue([]);
      setBatchId("");
      setCellLine("");
      navigation.navigate("ResultsInspector", { prediction, token });
    } catch (err: any) {
      console.error("Analysis Error:", err);
      alert("Something went wrong: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeFromQueue = (uri: string) => {
    setQueue(queue.filter(item => item.uri !== uri));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
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
            scrollEnabled={false} // Disabled because ScrollView handles the whole screen now
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
          
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Experiment Metadata</Text>
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter Batch ID (e.g., #004-B)"
              placeholderTextColor="#9CA3AF"
              value={batchId}
              onChangeText={setBatchId}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter Cell Line (e.g., hiPSC-CM)"
              placeholderTextColor="#9CA3AF"
              value={cellLine}
              onChangeText={setCellLine}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.analyzeButton, (queue.length === 0 || loading) && styles.disabledButton]} 
            onPress={handleAnalyze}
            disabled={queue.length === 0 || loading}
          >
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.analyzeButtonText}>Run Analysis</Text>}
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
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
  formContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 16,
    color: "#111827",
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