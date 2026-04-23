import { useState } from "react";
import { View, Button, Image, Text, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { getUploadUrl, createPrediction, getDownloadUrl } from "../services/api";

export default function UploadScreen({ token, onBack }) {
  const [image, setImage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // 📸 Pick image
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
    });

    if (!res.canceled) {
      setImage(res.assets[0]);
      setResult(null);
    }
  };

  // 🚀 Upload + Predict
  const handleAnalyze = async () => {
    if (!image) return;

    try {
      setLoading(true);

      const s3Key = `uploads/${Date.now()}.tiff`;

      // 1. Get upload URL
      const { upload_url } = await getUploadUrl(s3Key);

      // 2. Upload file to S3
      const file = await fetch(image.uri);
      const blob = await file.blob();

      await fetch(upload_url, {
        method: "PUT",
        body: blob,
      });

      // 3. Call prediction
      const prediction = await createPrediction(token, {
        project_id: "1",
        batch_id: "batch_001",
        cell_line: "A",
        original_image_s3_key: s3Key,
      });

      // 4. Get heatmap URL
      let heatmapUrl = null;
      if (prediction.heatmap_image_s3_key) {
        const res = await getDownloadUrl(prediction.heatmap_image_s3_key);
        heatmapUrl = res.download_url;
      }

      setResult({ ...prediction, heatmapUrl });

    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Button title="Back" onPress={onBack} />

      <Button title="Pick Image" onPress={pickImage} />

      {image && (
        <Image
          source={{ uri: image.uri }}
          style={{ width: 200, height: 200, marginVertical: 10 }}
        />
      )}

      <Button title="Analyze" onPress={handleAnalyze} />

      {loading && <ActivityIndicator size="large" />}

      {result && (
        <View style={{ marginTop: 20 }}>
          <Text>Outcome: {result.outcome}</Text>
          <Text>Confidence: {result.confidence}%</Text>

          {result.heatmapUrl && (
            <Image
              source={{ uri: result.heatmapUrl }}
              style={{ width: 200, height: 200 }}
            />
          )}
        </View>
      )}
    </View>
  );
}