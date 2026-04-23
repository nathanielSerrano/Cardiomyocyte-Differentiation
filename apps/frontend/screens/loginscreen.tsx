import { useState } from "react";
import { View, TextInput, Button, Text, StyleSheet } from "react-native";
import { login } from "../services/api";

export default function LoginScreen({ onLogin }) {
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
    <View style={styles.container}>
      <Text style={styles.title}>CardioPredict Login</Text>

      <TextInput
        placeholder="Username"
        value={user}
        onChangeText={setUser}
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <Button title="Login" onPress={handleLogin} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  error: {
    color: "red",
    marginTop: 10,
  },
});