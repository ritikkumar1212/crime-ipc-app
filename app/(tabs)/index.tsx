import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
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
import { SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(
    systemScheme === 'dark' ? 'dark' : 'light'
  );
  const [audienceMode, setAudienceMode] = useState<'general' | 'professional'>('general');
  const [inputText, setInputText] = useState('');
  const [scenarioRole, setScenarioRole] = useState<'self' | 'witness'>('self');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const resultCacheRef = useRef<Record<string, string | undefined>>({});
  const inFlightRef = useRef<Record<string, Promise<string> | undefined>>({});
  const slideAnim = useMemo(() => new Animated.Value(0), []);

  const theme = useMemo(() => getTheme(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const analyzeEndpoint = useMemo(() => {
    const deployedEndpoint = 'https://ipc-backend-j3ux.onrender.com/analyze';
    const envDefault = process.env.EXPO_PUBLIC_ANALYZE_URL;

    // Production APK should always hit deployed backend unless explicitly overridden.
    if (!__DEV__) {
      return process.env.EXPO_PUBLIC_ANALYZE_URL_PROD || deployedEndpoint;
    }

    if (Platform.OS === 'web') {
      return process.env.EXPO_PUBLIC_ANALYZE_URL_WEB || envDefault || 'http://localhost:3000/analyze';
    }
    if (Platform.OS === 'android') {
      return process.env.EXPO_PUBLIC_ANALYZE_URL_ANDROID || envDefault || 'http://10.0.2.2:3000/analyze';
    }
    return envDefault || deployedEndpoint;
  }, []);

  const buildCacheKey = (
    role: 'self' | 'witness',
    audience: 'general' | 'professional',
    analysisType: 'sections' | 'punishments' | 'next_steps',
    normalizedInput: string
  ) => `${audience}::${role}::${analysisType}::${normalizedInput.toLowerCase()}`;

  const buildScenarioPrompt = (
    role: 'self' | 'witness',
    audience: 'general' | 'professional',
    analysisType: 'sections' | 'punishments' | 'next_steps',
    normalizedInput: string
  ) => {
    const roleContext =
      role === 'self'
        ? 'Context: This incident is happening to the user or directly affecting them.'
        : 'Context: The user is only a witness/bystander, and the incident is not directly affecting them.';
    const audienceContext =
      audience === 'general'
        ? 'Audience: General public. Respond in very simple Hinglish (Roman script), avoid legal jargon, and keep wording easy to understand.'
        : 'Audience: Legal professional. Respond only in formal legal English with precise statutory and procedural terminology.';

    if (analysisType === 'sections') {
      if (audience === 'professional') {
        return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nReturn only the relevant BNS section numbers and official section headings as a concise list. No narrative, no advice, no punishments, no extra text. Do not mention IPC.`;
      }
      return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nReturn only the relevant BNS section numbers and section titles as a short list. Do not include explanations, punishments, safety advice, or any extra text. Do not mention IPC.`;
    }

    if (analysisType === 'punishments') {
      if (audience === 'professional') {
        return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nProvide punishment exposure for applicable BNS provisions in formal legal English.\n\nStrict output format (repeat this 3-line block for each section):\n* Section <number>: <official section heading>\n- Legal basis: <concise element-based applicability reason>\n- Sentencing exposure: <imprisonment/fine range in statutory wording>\n\nRules:\n1) No extra headings.\n2) No disclaimer.\n3) No extra bullet types.\n4) Keep it concise and technically precise.\n5) If multiple sections apply, separate each 3-line block with one blank line.\n6) Do not mention IPC.`;
      }
      return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nGive only punishment-focused output for relevant BNS sections in Hinglish. Do not mention IPC.\n\nStrict output format (repeat this 3-line block for each section):\n* Section <number>: <section title>\n- Why it applies: <one short reason>\n- Likely punishment: <jail/fine range in simple words>\n\nRules:\n1) No extra headings.\n2) No legal disclaimer.\n3) No extra bullet types.\n4) Keep it short and practical.\n5) If multiple sections apply, separate each 3-line block with one blank line.`;
    }

    if (role === 'self') {
      if (audience === 'professional') {
        return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nProvide a legally rigorous action plan in English for advising the affected person: (1) immediate protective/legal actions, and (2) post-incident procedural strategy, including reporting, evidence preservation, and counsel steps. Keep it concise. Do not mention IPC.`;
      }
      return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nFocus only on what the user should do next: (1) immediate actions during the incident, and (2) actions after the incident. Keep it practical and safety-first. Do not mention IPC.`;
    }

    if (audience === 'professional') {
      return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nProvide a legally rigorous witness-side action framework in English: (1) immediate safe intervention boundaries, and (2) post-incident procedural steps including reporting channels, evidence integrity, and witness statement protocol. Keep it concise. Do not mention IPC.`;
    }

    return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nFocus only on what a witness should do next: (1) immediate safe actions during the incident, and (2) actions after the incident including reporting, preserving evidence, and giving witness statement. Keep it practical and safety-first. Do not mention IPC.`;
  };

  const fetchAnalysis = async (
    role: 'self' | 'witness',
    audience: 'general' | 'professional',
    analysisType: 'sections' | 'punishments' | 'next_steps',
    normalizedInput: string
  ) => {
    const cacheKey = buildCacheKey(role, audience, analysisType, normalizedInput);
    const cached = resultCacheRef.current[cacheKey];
    if (cached) return cached;

    const inFlight = inFlightRef.current[cacheKey];
    if (inFlight) return inFlight;

    const scenarioText = buildScenarioPrompt(role, audience, analysisType, normalizedInput);

    const requestPromise = (async () => {
      let response: Response;
      try {
        response = await fetch(analyzeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scenario: normalizedInput,
            role,
            audienceMode: audience,
            analysisType,
            frontendPrompt: scenarioText,
          }),
        });
      } catch {
        return `Error: Failed to reach backend at ${analyzeEndpoint}. Ensure backend is running.`;
      }

      let data: { result?: string; error?: string } = {};
      try {
        data = await response.json();
      } catch {
        return `Error: Invalid server response (${response.status}).`;
      }

      if (!response.ok) {
        return `Error: ${data.error || `Server request failed (${response.status}).`}`;
      }

      if (!data.result || !data.result.trim()) {
        return 'Error: No response from server.';
      }

      const cleanedResult = stripIpcMentions(data.result);
      resultCacheRef.current[cacheKey] = cleanedResult;
      return cleanedResult;
    })();

    inFlightRef.current[cacheKey] = requestPromise;
    // Prevent dev red-screen from transient unhandled rejection timing.
    requestPromise.catch(() => {});
    requestPromise.finally(() => {
      delete inFlightRef.current[cacheKey];
    });

    return requestPromise;
  };

  const prefetchOtherAnalyses = (
    role: 'self' | 'witness',
    audience: 'general' | 'professional',
    selectedType: 'sections' | 'punishments' | 'next_steps',
    normalizedInput: string
  ) => {
    ANALYSIS_TYPES.filter((type) => type !== selectedType).forEach((type) => {
      const key = buildCacheKey(role, audience, type, normalizedInput);
      if (resultCacheRef.current[key] || inFlightRef.current[key]) return;
      void fetchAnalysis(role, audience, type, normalizedInput).catch(() => {
        // Silently ignore background prefetch failures.
      });
    });
  };

  const getIpcSections = async (
    analysisType: 'sections' | 'punishments' | 'next_steps'
  ) => {
    const normalizedInput = inputText.trim();
    if (!normalizedInput) return;

    const activeRole = scenarioRole;
    const activeAudience = audienceMode;
    const cacheKey = buildCacheKey(activeRole, activeAudience, analysisType, normalizedInput);
    const cached = resultCacheRef.current[cacheKey];
    if (cached) {
      setResult(cached);
      prefetchOtherAnalyses(activeRole, activeAudience, analysisType, normalizedInput);
      return;
    }

    setLoading(true);
    setResult('');

    try {
      const primaryResult = await fetchAnalysis(
        activeRole,
        activeAudience,
        analysisType,
        normalizedInput
      );
      setResult(primaryResult);
      prefetchOtherAnalyses(activeRole, activeAudience, analysisType, normalizedInput);
    } catch (error) {
      console.log('Analyze request failed:', error);
      const message = error instanceof Error ? error.message : 'Error fetching BNS data.';
      setResult(`Error: ${message}`);
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
  const resultLines = useMemo(() => result.split('\n'), [result]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} translucent />
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => (menuOpen ? closeMenu() : openMenu())}
          accessibilityLabel="Open menu"
        >
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </TouchableOpacity>
      </View>

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
            <Text style={styles.menuSectionLabel}>Interface</Text>
            <TouchableOpacity
              style={[styles.menuItem, audienceMode === 'general' && styles.menuItemActive]}
              onPress={() => {
                setAudienceMode('general');
                setResult('');
                closeMenu();
              }}
            >
              <Text
                style={[
                  styles.menuItemText,
                  audienceMode === 'general' && styles.menuItemTextActive,
                ]}>
                General Public
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, audienceMode === 'professional' && styles.menuItemActive]}
              onPress={() => {
                setAudienceMode('professional');
                setResult('');
                closeMenu();
              }}
            >
              <Text
                style={[
                  styles.menuItemText,
                  audienceMode === 'professional' && styles.menuItemTextActive,
                ]}>
                Legal Professional
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                handleToggleTheme();
                closeMenu();
              }}
            >
              <Text style={styles.menuItemText}>
                {themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.heading}>
            {audienceMode === 'professional' ? 'Nyay Sathi Pro' : 'Nyay Sathi'}
          </Text>
          <Text style={styles.subheading}>
            {audienceMode === 'professional'
              ? 'Draft facts and receive formal legal analysis'
              : 'Draft a scenario and receive legal help fast'}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputTitle}>Scenario</Text>
          </View>
          <View style={styles.modeRow}>
            {SCENARIO_MODES.map((mode) => {
              const active = scenarioRole === mode.value;
              return (
                <TouchableOpacity
                  key={mode.value}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => setScenarioRole(mode.value)}
                >
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                    {audienceMode === 'professional' ? mode.proLabel : mode.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={styles.input}
            placeholder={
              audienceMode === 'professional'
                ? 'Enter material facts, chronology, intent, parties, and available evidence...'
                : 'Describe the crime scenario in detail...'
            }
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
            {audienceMode === 'professional'
              ? scenarioRole === 'self'
                ? 'Tip: include mens rea indicators, injury grading, timeline, and evidentiary material.'
                : 'Tip: include witness vantage point, timeline, identities, and evidence custody details.'
              : scenarioRole === 'self'
                ? 'Tip: include intent, weapon used, and injuries for best results.'
                : 'Tip: include place, time, people involved, vehicle details, and what you observed.'}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              !inputText.trim() && styles.buttonDisabled,
            ]}
            onPress={() => getIpcSections('sections')}
            disabled={!inputText.trim()}
          >
            <Text style={styles.buttonText}>BNS Sections</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              !inputText.trim() && styles.buttonDisabled,
            ]}
            onPress={() => getIpcSections('punishments')}
            disabled={!inputText.trim()}
          >
            <Text style={styles.buttonText}>Punishments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              !inputText.trim() && styles.buttonDisabled,
            ]}
            onPress={() => getIpcSections('next_steps')}
            disabled={!inputText.trim()}
          >
            <Text style={styles.buttonText}>What To Do Next</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.resultBox} contentContainerStyle={styles.resultContent}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Analysis</Text>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                {loading ? 'Thinking' : result ? 'Ready' : 'Idle'}
              </Text>
            </View>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={theme.accent} />
          ) : result ? (
            <View style={styles.resultLinesWrap}>
              {resultLines.map((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) {
                  return <View key={`line-${index}`} style={styles.resultSpacer} />;
                }

                const colonIndex = line.indexOf(':');
                const hasLeadHeading = colonIndex > 0 && colonIndex < 45;
                const isHeadingLike =
                  /^#{1,6}\s+/.test(trimmed) ||
                  /^bns\s*section/i.test(trimmed) ||
                  /^section\s*\d+/i.test(trimmed) ||
                  /^\*\*.+\*\*$/.test(trimmed) ||
                  /^[A-Za-z][A-Za-z0-9 ()/-]{1,40}:/.test(trimmed);

                if (hasLeadHeading) {
                  const lead = line.slice(0, colonIndex).trim();
                  const rest = line.slice(colonIndex + 1).trim();
                  return (
                    <Text key={`line-${index}`} style={styles.resultText}>
                      <Text style={styles.resultLead}>{lead}:</Text>
                      {rest ? ` ${rest}` : ''}
                    </Text>
                  );
                }

                return (
                  <Text
                    key={`line-${index}`}
                    style={isHeadingLike ? styles.resultHeadingLine : styles.resultText}>
                    {line}
                  </Text>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No analysis yet</Text>
              <Text style={styles.emptyText}>
                Add a scenario and tap "BNS Sections", "Punishments", or "What To Do Next".
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const stripIpcMentions = (text: string) =>
  text
    .replace(/\((?:[^()]*\bIPC\b[^()]*)\)/gi, '')
    .replace(/\bIPC\s*Section\s*[0-9A-Za-z./()-]+/gi, '')
    .replace(/\bIPC\s*[0-9A-Za-z./()-]+/gi, '')
    .replace(/\bIPC\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

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

const SCENARIO_MODES = [
  { label: 'Mere Saath Hua', proLabel: 'Happened With Me', value: 'self' as const },
  { label: 'Mere Saamne Hua', proLabel: 'Happened In Front Of Me', value: 'witness' as const },
];

const ANALYSIS_TYPES = ['sections', 'punishments', 'next_steps'] as const;

const getTheme = (mode: 'light' | 'dark') => {
  if (mode === 'dark') {
    return {
      background: '#0a1020',
      surface: '#121a2b',
      surfaceAlt: '#1b2640',
      text: '#f5ecd1',
      muted: '#c7b88c',
      border: '#3a4b6e',
      accent: '#c9a44d',
      accentStrong: '#9c7a2f',
      shadow: '#000000',
      buttonText: '#1a1407',
    };
  }
  return {
    background: '#f2ecdc',
    surface: '#fffaf0',
    surfaceAlt: '#f7ecd2',
    text: '#1f2a3d',
    muted: '#6f6247',
    border: '#dccaa0',
    accent: '#a57c2c',
    accentStrong: '#7f5f1f',
    shadow: '#121212',
    buttonText: '#fff8e7',
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
      backgroundColor: theme.background,
    },
    content: {
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: Platform.select({ android: 10, default: 14 }),
    },
    menuContainer: {
      position: 'absolute',
      top: Platform.select({ android: 26, default: 14 }),
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
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    menuItemActive: {
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    menuSectionLabel: {
      marginTop: 10,
      marginBottom: 6,
      color: theme.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    menuItemText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    menuItemTextActive: {
      color: theme.accent,
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
    card: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      ...getShadow(theme, 18, 8, 6, themeModeShadowOpacity(theme)),
    },
    inputHeader: {
      marginBottom: 10,
    },
    modeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    modeChip: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accentStrong,
    },
    modeChipText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    modeChipTextActive: {
      color: '#ffffff',
    },
    inputTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
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
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 18,
      marginBottom: 18,
    },
    optionButton: {
      flex: 1,
      backgroundColor: theme.accent,
      padding: 16,
      borderRadius: 14,
      ...getShadow(theme, 16, 6, 4, themeModeShadowOpacity(theme)),
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: {
      color: theme.buttonText,
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
    resultLinesWrap: {
      gap: 4,
    },
    resultSpacer: {
      height: 8,
    },
    resultHeadingLine: {
      fontSize: 15,
      color: theme.accent,
      lineHeight: 22,
      fontWeight: '700',
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
    },
    resultLead: {
      color: theme.accent,
      fontWeight: '700',
      fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' }),
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
