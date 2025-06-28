import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity
} from 'react-native';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const getIpcSections = async () => {
    if (!inputText.trim()) return;

    setLoading(true);
    setResult('');

    try {
      const response = await fetch('https://ipc-backend-j3ux.onrender.com/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scenario: inputText }),
      });

      const data = await response.json();
      setResult(data.result || 'No response from server.');
    } catch (error) {
      setResult('❌ Error fetching IPC data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Indian IPC Analyzer</Text>

      <TextInput
        style={styles.input}
        placeholder="Describe the crime scenario..."
        multiline
        value={inputText}
        onChangeText={setInputText}
      />

      <TouchableOpacity style={styles.button} onPress={getIpcSections}>
        <Text style={styles.buttonText}>Get IPC Sections</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <ScrollView style={styles.resultBox}>
          <Text style={styles.resultText}>{result}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: {
    height: 120,
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    textAlignVertical: 'top',
    borderRadius: 8,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  resultBox: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    padding: 15,
    borderRadius: 8,
  },
  resultText: { fontSize: 16, color: '#333' },
});
