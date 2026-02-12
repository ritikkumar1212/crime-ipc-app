import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  StatusBar,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';

export default function App() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(
    systemScheme === 'dark' ? 'dark' : 'light'
  );
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const slideAnim = useMemo(() => new Animated.Value(0), []);

  const theme = useMemo(() => getTheme(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

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
      setResult('❌ Error fetching BNS data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleUseExample = (text: string) => {
    setInputText(text);
  };

  const openMenu = () => {
    setMenuOpen(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) setMenuOpen(false);
    });
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-240, 0],
  });
  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <Pressable
        style={styles.menuContainer}
        onHoverIn={openMenu}
      >
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => (menuOpen ? closeMenu() : openMenu())}
          accessibilityLabel="Open menu"
        >
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </TouchableOpacity>
      </Pressable>

      {menuOpen && (
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <Animated.View style={[styles.menuScrim, { opacity: overlayOpacity }]} />
          <Animated.View style={[styles.menuPanel, { transform: [{ translateX }] }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                router.push('/');
              }}
            >
              <Text style={styles.menuItemText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                router.push('/(tabs)/explore');
              }}
            >
              <Text style={styles.menuItemText}>Contact a Lawyer</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.heading}>BNS Analyzer</Text>
          <Text style={styles.subheading}>
            Draft a scenario and receive relevant sections fast.
          </Text>
          <TouchableOpacity style={styles.themeButton} onPress={handleToggleTheme}>
            <Text style={styles.themeButtonText}>
              {themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputTitle}>Scenario</Text>
            <Text style={styles.charCount}>{inputText.length} chars</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Describe the crime scenario in detail..."
            placeholderTextColor={theme.muted}
            multiline
            value={inputText}
            onChangeText={setInputText}
            textAlignVertical="top"
          />
          <View style={styles.actionsRow}>
            <View style={styles.chipsRow}>
              {EXAMPLES.map((example) => (
                <TouchableOpacity
                  key={example.label}
                  style={styles.chip}
                  onPress={() => handleUseExample(example.text)}
                >
                  <Text style={styles.chipText}>{example.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.clearButton, !inputText && styles.clearButtonDisabled]}
              onPress={() => setInputText('')}
              disabled={!inputText}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            Tip: include intent, weapon used, and injuries for best results.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, (!inputText.trim() || loading) && styles.buttonDisabled]}
          onPress={getIpcSections}
          disabled={!inputText.trim() || loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Analyzing...' : 'Get BNS Sections'}
          </Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={theme.accent} />
        ) : (
          <ScrollView style={styles.resultBox} contentContainerStyle={styles.resultContent}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Analysis</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{result ? 'Ready' : 'Idle'}</Text>
              </View>
            </View>
            {result ? (
              <Text style={styles.resultText}>{result}</Text>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No analysis yet</Text>
                <Text style={styles.emptyText}>
                  Add a scenario and tap "Get BNS Sections" to see results here.
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const EXAMPLES = [
  {
    label: 'Robbery',
    text: 'A masked person broke into a jewelry shop at night, threatened the guard with a knife, and took gold ornaments.',
  },
  {
    label: 'Fraud',
    text: 'A person created fake documents to obtain a bank loan and then disappeared without repayment.',
  },
  {
    label: 'Assault',
    text: 'During a street argument, one individual hit another with a metal rod causing serious injuries.',
  },
];

const getTheme = (mode: 'light' | 'dark') => {
  if (mode === 'dark') {
    return {
      background: '#0b0f1c',
      surface: '#151b2f',
      surfaceAlt: '#1c2440',
      text: '#f4f7ff',
      muted: '#b4bdd6',
      border: '#2b3558',
      accent: '#6ee7f0',
      accentStrong: '#41c7d3',
      shadow: '#000000',
    };
  }
  return {
    background: '#f5f2ee',
    surface: '#ffffff',
    surfaceAlt: '#f6f8ff',
    text: '#131722',
    muted: '#5b6476',
    border: '#e0e4ef',
    accent: '#2563eb',
    accentStrong: '#1d4ed8',
    shadow: '#121212',
  };
};

const getShadow = (
  theme: ReturnType<typeof getTheme>,
  radius: number,
  height: number,
  elevation: number,
  opacity: number
) =>
  Platform.select({
    web: {
      boxShadow: `0px ${height}px ${radius}px rgba(0, 0, 0, ${opacity})`,
    },
    default: {
      shadowColor: theme.shadow,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height },
      elevation,
    },
  });

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 18,
      backgroundColor: theme.background,
    },
    content: { width: '100%', maxWidth: 520, alignSelf: 'center', flex: 1 },
    menuContainer: {
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: 10,
    },
    menuButton: {
      width: 42,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      ...getShadow(theme, 10, 4, 3, themeModeShadowOpacity(theme)),
    },
    menuLine: {
      width: 18,
      height: 2,
      borderRadius: 999,
      backgroundColor: theme.text,
    },
    menuPanel: {
      width: 220,
      height: '100%',
      paddingTop: 72,
      paddingHorizontal: 16,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      ...getShadow(theme, 18, 8, 6, themeModeShadowOpacity(theme)),
      overflow: 'hidden',
    },
    menuItem: {
      paddingVertical: 12,
    },
    menuItemText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    menuOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9,
    },
    menuScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(8, 12, 24, 0.35)',
    },
    header: {
      alignItems: 'center',
      gap: 10,
      marginBottom: 18,
    },
    heading: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'serif' }),
    },
    subheading: {
      fontSize: 14,
      color: theme.muted,
      textAlign: 'center',
      maxWidth: 320,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-light' }),
    },
    themeButton: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    themeButtonText: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 12,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      ...getShadow(theme, 18, 8, 6, themeModeShadowOpacity(theme)),
    },
    inputHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    inputTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    charCount: {
      fontSize: 12,
      color: theme.muted,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-light' }),
    },
    input: {
      minHeight: 96,
      borderColor: theme.border,
      borderWidth: 1,
      padding: 12,
      color: theme.text,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      lineHeight: Platform.select({ ios: 20, android: 22, default: 20 }),
      fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    actionsRow: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
    chip: {
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    clearButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    clearButtonDisabled: { opacity: 0.5 },
    clearButtonText: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 12,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    helperText: {
      marginTop: 12,
      fontSize: 12,
      color: theme.muted,
      textAlign: 'center',
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-light' }),
    },
    button: {
      backgroundColor: theme.accent,
      padding: 16,
      borderRadius: 14,
      marginTop: 18,
      marginBottom: 18,
      ...getShadow(theme, 16, 6, 4, themeModeShadowOpacity(theme)),
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: {
      color: '#fff',
      textAlign: 'center',
      fontWeight: '700',
      letterSpacing: 0.4,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    resultBox: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    resultContent: { padding: 16 },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      gap: 10,
    },
    resultTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.accent,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    resultText: {
      fontSize: 15,
      color: theme.text,
      lineHeight: 22,
      fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    emptyState: { alignItems: 'center', paddingVertical: 30 },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    emptyText: {
      marginTop: 8,
      textAlign: 'center',
      color: theme.muted,
      fontSize: 13,
      maxWidth: 260,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-light' }),
    },
    backgroundGlowTop: {
      position: 'absolute',
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: theme.accent,
      opacity: themeModeGlowOpacity(theme),
      top: -120,
      right: -40,
      pointerEvents: 'none',
    },
    backgroundGlowBottom: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: theme.accentStrong,
      opacity: themeModeGlowOpacity(theme),
      bottom: -140,
      left: -60,
      pointerEvents: 'none',
    },
  });

const themeModeShadowOpacity = (theme: ReturnType<typeof getTheme>) =>
  theme.background === '#0b0f1c' ? 0.45 : 0.18;

const themeModeGlowOpacity = (theme: ReturnType<typeof getTheme>) =>
  theme.background === '#0b0f1c' ? 0.22 : 0.16;
