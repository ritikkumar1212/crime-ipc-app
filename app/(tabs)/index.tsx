import React, { useState } from 'react';
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function HomeScreen() {
  const [scenario, setScenario] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    setLoading(true);
    // Send to backend logic here
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Describe the Crime Scenario:</Text>
          <TextInput
            value={scenario}
            onChangeText={setScenario}
            placeholder="E.g., A man broke into a house and stole..."
            placeholderTextColor="#aaa"
            multiline
            style={styles.input}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={loading ? 'Analyzing...' : 'Get IPC Sections'}
            onPress={handleSubmit}
            disabled={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  keyboardContainer: { flex: 1 },
  content: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 120,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  footer: {
    padding: 15,
    borderTopColor: '#ddd',
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
});
