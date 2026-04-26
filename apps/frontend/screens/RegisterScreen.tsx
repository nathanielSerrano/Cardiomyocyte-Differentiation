import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, StyleSheet, StatusBar, ScrollView } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { register } from "../services/api";

export default function RegisterScreen({ onBack }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!user || !password || !projectName) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      // Note: Backend /register expects item: LoginCreate and project_name query param
      await register(user, password,  projectName);
      
      alert("Account created successfully! Please log in.");
      onBack();
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollInner}>
        <TouchableOpacity style={styles.backLink} onPress={onBack}>
          <Text style={styles.backLinkText}>← Back to Login</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Join MyoScope</Text>
          <Text style={styles.subtitle}>Start analyzing your cell lines</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            placeholder="e.g. dr_smith"
            value={user}
            onChangeText={setUser}
            style={styles.input}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <Text style={styles.label}>Initial Project Name</Text>
          <TextInput
            placeholder="e.g. My Cardiomyocyte Study"
            value={projectName}
            onChangeText={setProjectName}
            style={styles.input}
          />

          <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.7 }]} 
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? "Creating..." : "Create Account"}</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollInner: { padding: 20, justifyContent: 'center', minHeight: '100%' },
  backLink: { marginBottom: 20 },
  backLinkText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  header: { marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  error: { color: '#EF4444', marginTop: 12, textAlign: "center" },
});