import { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import { login } from "../services/api";

export default function LoginScreen({ onLogin, onGoToRegister }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setError("");

      const res = await login(user, password);

      if (res.access_token) {
        onLogin(res.access_token); // send token to parent
      } else {
        setError("Invalid login response");
      }
    } catch (err) {
      setError("Login failed");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>CardioPredict</Text>
          <Text style={styles.subtitle}>Morphology Analysis Portal</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            placeholder="Username"
            value={user}
            onChangeText={setUser}
            style={styles.input}
            autoCapitalize="none"
          />

          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <TouchableOpacity style={styles.footer} onPress={onGoToRegister}>
          <Text style={styles.footerText}>
            Don't have an account? <Text style={styles.link}>Create one</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
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
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
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
  error: {
    color: '#EF4444',
    marginTop: 12,
    textAlign: "center",
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    color: '#4B5563',
    fontSize: 14,
  },
  link: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
});