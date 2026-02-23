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

type ExampleCategory = 'robbery' | 'fraud' | 'assault';
type ExampleRole = 'self' | 'witness';
type ExampleCursorKey = `${ExampleRole}:${ExampleCategory}`;

export default function App() {
  const OUTPUT_SCHEMA_VERSION = 'v3';
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(
    systemScheme === 'dark' ? 'dark' : 'light'
  );
  const audienceMode: 'general' = 'general';
  const [inputText, setInputText] = useState('');
  const [scenarioRole, setScenarioRole] = useState<'self' | 'witness'>('self');
  const [result, setResult] = useState('');
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<
    'sections' | 'punishments' | 'next_steps' | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const resultCacheRef = useRef<Record<string, string | undefined>>({});
  const inFlightRef = useRef<Record<string, Promise<string> | undefined>>({});
  const exampleCursorRef = useRef<Record<ExampleCursorKey, number>>({
    'self:robbery': 0,
    'self:fraud': 0,
    'self:assault': 0,
    'witness:robbery': 0,
    'witness:fraud': 0,
    'witness:assault': 0,
  });
  const slideAnim = useMemo(() => new Animated.Value(0), []);

  const theme = useMemo(() => getTheme(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const analyzeEndpoint = useMemo(() => {
    const deployedEndpoint = 'https://ipc-backend-j3ux.onrender.com/analyze';
    const sharedEndpoint = process.env.EXPO_PUBLIC_ANALYZE_URL;
    const prodEndpoint = process.env.EXPO_PUBLIC_ANALYZE_URL_PROD;
    // Force one backend across web/app/Expo Go so outputs stay aligned.
    return sharedEndpoint || prodEndpoint || deployedEndpoint;
  }, []);

  const buildCacheKey = (
    role: 'self' | 'witness',
    audience: 'general',
    analysisType: 'sections' | 'punishments' | 'next_steps',
    normalizedInput: string
  ) =>
    `${OUTPUT_SCHEMA_VERSION}::${audience}::${role}::${analysisType}::${normalizedInput.toLowerCase()}`;

  const buildScenarioPrompt = (
    role: 'self' | 'witness',
    audience: 'general',
    analysisType: 'sections' | 'punishments' | 'next_steps',
    normalizedInput: string
  ) => {
    const roleContext =
      role === 'self'
        ? 'Context: This incident is happening to the user or directly affecting them.'
        : 'Context: The user is only a witness/bystander, and the incident is not directly affecting them.';
    const audienceContext =
      'Audience: General public. Respond in very simple Hinglish (Roman script), avoid legal jargon, and keep wording easy to understand.';

    if (analysisType === 'sections') {
      return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nStrictly use simple Hinglish (Roman Hindi). English sentences mat likho; sirf legal terms jaise BNS/Section/FIR allowed hain.\n\nOutput format:\n* Section <number>: <short section title in Hinglish>\n- Kyun lagu hota hai: <ek line, simple Hinglish>\n\nRules:\n1) Sirf BNS sections + why applicable.\n2) Punishment, safety advice, ya next steps mat do.\n3) Do not mention IPC.`;
    }

    if (analysisType === 'punishments') {
      return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nStrictly use simple Hinglish (Roman Hindi). English sentences mat likho; sirf legal terms jaise BNS/Section/FIR allowed hain. Do not mention IPC.\n\nStrict output format (repeat this 3-line block for each section):\n* Section <number>: <section title in Hinglish>\n- Kyun lagu hota hai: <one short reason in Hinglish>\n- Sambhavit saza: <jail/fine range in simple Hinglish>\n\nRules:\n1) No extra headings.\n2) No legal disclaimer.\n3) No extra bullet types.\n4) Keep it short and practical.\n5) If multiple sections apply, separate each 3-line block with one blank line.`;
    }

    if (role === 'self') {
      return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nStrictly use simple Hinglish (Roman Hindi). English sentences mat likho; sirf legal terms jaise BNS/Section/FIR allowed hain.\nFocus only on what the user should do next: (1) immediate actions during the incident, and (2) actions after the incident. Keep it practical and safety-first. Do not mention IPC.`;
    }

    return `${normalizedInput}\n\n${roleContext}\n${audienceContext}\nStrictly use simple Hinglish (Roman Hindi). English sentences mat likho; sirf legal terms jaise BNS/Section/FIR allowed hain.\nFocus only on what a witness should do next: (1) immediate safe actions during the incident, and (2) actions after the incident including reporting, preserving evidence, and giving witness statement. Keep it practical and safety-first. Do not mention IPC.`;
  };

  const fetchAnalysis = async (
    role: 'self' | 'witness',
    audience: 'general',
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
      const focusedResult = focusAnalysisResult(cleanedResult, analysisType);
      resultCacheRef.current[cacheKey] = focusedResult;
      return focusedResult;
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
    audience: 'general',
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
    setSelectedAnalysisType(analysisType);
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

  const handleUseExample = (category: ExampleCategory) => {
    const scenarios = EXAMPLE_SCENARIOS[scenarioRole][category];
    if (!scenarios?.length) return;
    const cursorKey = `${scenarioRole}:${category}` as ExampleCursorKey;
    const cursor = exampleCursorRef.current[cursorKey] || 0;
    setInputText(scenarios[cursor]);
    exampleCursorRef.current[cursorKey] = (cursor + 1) % scenarios.length;
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
  const structuredResult = useMemo(
    () => buildStructuredResult(result, selectedAnalysisType),
    [result, selectedAnalysisType]
  );

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
            <Text style={styles.heading}>Nyay Sathi</Text>
            <Text style={styles.subheading}>Draft a scenario and receive legal help fast</Text>
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
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={styles.input}
            placeholder={'Describe the crime scenario in detail...'}
            placeholderTextColor={theme.muted}
            multiline
            value={inputText}
            onChangeText={setInputText}
            textAlignVertical="top"
          />
          <View style={styles.actionsRow}>
            <View style={styles.chipsRow}>
              {EXAMPLE_BUTTONS.map((example) => (
                <TouchableOpacity
                  key={example.key}
                  style={styles.chip}
                  onPress={() => handleUseExample(example.key)}
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
            {scenarioRole === 'self'
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
            <Text style={styles.buttonText}>BNS Sections + Why It Applies</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              !inputText.trim() && styles.buttonDisabled,
            ]}
            onPress={() => getIpcSections('punishments')}
            disabled={!inputText.trim()}
          >
            <Text style={styles.buttonText}>Punishment</Text>
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
              <Text style={styles.resultHeadingLine}>{structuredResult.title}</Text>
              {structuredResult.items.map((item, index) => {
                const highlighted = splitSectionLead(item);
                return (
                  <View key={`item-${index}`} style={styles.resultItemRow}>
                    <Text style={styles.resultBullet}>-</Text>
                    {selectedAnalysisType === 'sections' ? (
                      highlighted.highlight ? (
                        <Text style={styles.resultText}>
                          <Text style={styles.resultLead}>{highlighted.lead}</Text>
                          {highlighted.detail ? `: ${highlighted.detail}` : ''}
                        </Text>
                      ) : (
                        <Text style={styles.resultText}>{highlighted.detail}</Text>
                      )
                    ) : (
                      <Text style={styles.resultText}>{item}</Text>
                    )}
                  </View>
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

const focusAnalysisResult = (
  text: string,
  analysisType: 'sections' | 'punishments' | 'next_steps'
) => {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return normalized;

  const lines = normalized.split('\n');
  const sectionHeadings = [
    'relevant bns sections',
    'bns sections',
    'relevant sections',
    'applicable sections',
  ];
  const punishmentHeadings = [
    'likely punishments',
    'punishments',
    'punishment',
    'sentencing exposure',
    'sentencing',
  ];
  const nextStepHeadings = [
    'immediate actions',
    'what to do next',
    'next steps',
    'steps after the incident',
    'steps after incident',
    'post-incident steps',
    'post incident steps',
    'safety/legality caveats',
    'safety caveats',
  ];

  const headingOf = (line: string) =>
    line
      .toLowerCase()
      .replace(/[`*_>#-]/g, ' ')
      .replace(/:/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const isHeadingMatch = (line: string, headingKeys: string[]) => {
    const normalizedHeading = headingOf(line);
    return headingKeys.some((key) => normalizedHeading.includes(key));
  };

  const findFirstHeadingIndex = (headingKeys: string[]) =>
    lines.findIndex((line) => isHeadingMatch(line, headingKeys));

  const extractHeadingBlock = (startKeys: string[], stopKeys: string[]) => {
    const start = findFirstHeadingIndex(startKeys);
    if (start < 0) return '';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (isHeadingMatch(lines[i], stopKeys)) {
        end = i;
        break;
      }
    }
    return lines.slice(start, end).join('\n').trim();
  };

  if (analysisType === 'sections') {
    const fromHeadings = extractHeadingBlock(sectionHeadings, [
      ...punishmentHeadings,
      ...nextStepHeadings,
    ]);
    if (fromHeadings) return fromHeadings;

    const fallback = lines.filter(
      (line) =>
        /\bsection\s*[0-9A-Za-z./()-]+/i.test(line) &&
        !/\b(punishment|sentencing|imprisonment|jail|fine|immediate|next steps?|what to do)\b/i.test(
          line
        )
    );
    return fallback.length ? fallback.join('\n').trim() : normalized;
  }

  if (analysisType === 'punishments') {
    const fromHeadings = extractHeadingBlock(punishmentHeadings, nextStepHeadings);
    if (fromHeadings) return fromHeadings;

    const fallback = lines.filter((line) =>
      /\b(punishment|sentencing|imprisonment|jail|fine|saza)\b/i.test(line)
    );
    return fallback.length ? fallback.join('\n').trim() : normalized;
  }

  const firstNextStepIndex = findFirstHeadingIndex(nextStepHeadings);
  if (firstNextStepIndex >= 0) {
    return lines.slice(firstNextStepIndex).join('\n').trim();
  }

  const fallback = lines.filter((line) =>
    /\b(immediate|next steps?|what to do|report|police|fir|evidence|witness|safety|after the incident)\b/i.test(
      line
    )
  );
  return fallback.length ? fallback.join('\n').trim() : normalized;
};

const splitSectionLead = (item: string) => {
  const normalizedItem = item.replace(/\s+/g, ' ').trim();
  const sectionMatch = normalizedItem.match(/^(section|charge)\s*[0-9A-Za-z./()-]+/i);
  if (!sectionMatch) {
    return { lead: '', detail: normalizedItem, highlight: false };
  }
  const lead = sectionMatch[0].trim();
  const detail = normalizedItem.slice(lead.length).trim().replace(/^[:\-]\s*/, '');
  return { lead, detail, highlight: true };
};

const buildStructuredResult = (
  text: string,
  analysisType: 'sections' | 'punishments' | 'next_steps' | null
) => {
  const normalizedText = text.replace(/\r\n/g, '\n').trim();
  if (!normalizedText) {
    return { title: 'Analysis', items: [] as string[] };
  }

  const normalizeLine = (line: string) =>
    line
      .replace(/^\s*[*\-+]\s*/, '')
      .replace(/^\s*\d+[.)]\s*/, '')
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const cleanGeneralLine = (line: string) =>
    line
      .replace(/\s*\[[^\]]*]/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/applies because/gi, 'kyunki')
      .replace(/why it applies/gi, 'kyun lagu hota hai')
      .replace(/likely punishment/gi, 'sambhavit saza')
      .replace(/[\u0900-\u097F]+/g, ' ')
      .replace(/^[\s:;,-]+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const headingOf = (line: string) =>
    line
      .toLowerCase()
      .replace(/[`*_>#-]/g, ' ')
      .replace(/:/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const isHeadingLine = (line: string) => {
    const normalizedHeading = headingOf(line);
    return (
      normalizedHeading.startsWith('crime scenario') ||
      normalizedHeading === 'relevant bns sections' ||
      normalizedHeading === 'bns sections' ||
      normalizedHeading === 'likely punishments' ||
      normalizedHeading === 'punishments' ||
      normalizedHeading === 'punishment' ||
      normalizedHeading === 'immediate actions' ||
      normalizedHeading === 'what to do next' ||
      normalizedHeading === 'next steps' ||
      normalizedHeading === 'steps after the incident' ||
      normalizedHeading === 'steps after incident' ||
      normalizedHeading === 'post incident steps' ||
      normalizedHeading === 'safety legality caveats' ||
      normalizedHeading === 'safety caveats'
    );
  };

  const uniqueItems = (items: string[]) => {
    const seen = new Set<string>();
    const deduped: string[] = [];
    items.forEach((item) => {
      const normalizedItem = item.trim();
      if (!normalizedItem) return;
      const key = normalizedItem.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(normalizedItem);
    });
    return deduped;
  };

  const lines = normalizedText.split('\n').map(normalizeLine).filter(Boolean);
  const contentLines = lines.filter((line) => !isHeadingLine(line)).map(cleanGeneralLine).filter(Boolean);

  const sectionPattern = /\bsection\s*([0-9A-Za-z./()-]+)\b/i;
  const reasonPattern = /\b(kyun|kyunki|isliye|lagu hota hai|because|applies)\b/i;
  const punishmentPattern = /\b(saza|jail|fine|imprisonment|years?)\b/i;
  const actionPattern = /\b(police|fir|report|evidence|medical|witness|safety|turant|immediate|step|karein|karna chahiye)\b/i;

  const parseSectionEntries = () => {
    const entries: Array<{ number: string; title: string; reason: string; punishment: string }> = [];
    for (let i = 0; i < contentLines.length; i += 1) {
      const line = contentLines[i];
      const regexMatch = /section\s*([0-9A-Za-z./()-]+)/i.exec(line);
      if (!regexMatch) continue;

      const number = regexMatch[1];
      const matchIndex = regexMatch.index ?? 0;
      const matchedTextLength = regexMatch[0].length;
      const afterSection = line.slice(matchIndex + matchedTextLength);
      let title = afterSection.replace(/^[:\-\s]+/, '').trim();
      let reason = '';
      let punishment = '';

      if (reasonPattern.test(title)) {
        const idx = title.search(reasonPattern);
        reason = title.slice(idx).replace(/^[-:\s]+/, '').trim();
        title = title.slice(0, idx).trim();
      }
      if (punishmentPattern.test(title)) {
        punishment = title;
        title = '';
      }

      const nextLine = contentLines[i + 1];
      if (nextLine && !sectionPattern.test(nextLine)) {
        if (!reason && reasonPattern.test(nextLine)) {
          reason = nextLine.replace(/^[-:\s]+/, '').trim();
          i += 1;
        } else if (!punishment && punishmentPattern.test(nextLine)) {
          punishment = nextLine.replace(/^[-:\s]+/, '').trim();
          i += 1;
        }
      }

      entries.push({ number, title, reason, punishment });
    }

    const deduped = new Map<string, { number: string; title: string; reason: string; punishment: string }>();
    entries.forEach((entry) => {
      const prev = deduped.get(entry.number);
      if (!prev) {
        deduped.set(entry.number, entry);
        return;
      }
      deduped.set(entry.number, {
        number: entry.number,
        title: prev.title || entry.title,
        reason: prev.reason || entry.reason,
        punishment: prev.punishment || entry.punishment,
      });
    });
    return Array.from(deduped.values());
  };

  const entries = parseSectionEntries();

  if (analysisType === 'sections') {
    const items: string[] = [];
    entries.slice(0, 6).forEach((entry) => {
      items.push(`Section ${entry.number}: ${entry.title || 'Relevant BNS section'}`);
      items.push(`Kyun lagu hota hai: ${entry.reason || 'Diye gaye facts ke basis par yeh section lagu hota hai.'}`);
    });
    return {
      title: 'BNS Sections + Kyun Lagu Hota Hai',
      items: items.length ? items : ['Is scenario ke liye clear BNS section nahi mila.'],
    };
  }

  if (analysisType === 'punishments') {
    const itemsFromSections = entries
      .map((entry) => {
        const punish =
          entry.punishment ||
          contentLines.find(
            (line) => line.match(sectionPattern)?.[1] === entry.number && punishmentPattern.test(line)
          ) ||
          '';
        if (!punish) return '';
        return `Section ${entry.number}: ${punish.replace(/^section\s*[0-9A-Za-z./()-]+\s*[:\-]?\s*/i, '')}`;
      })
      .filter(Boolean);

    const fallbackItems = contentLines
      .filter((line) => punishmentPattern.test(line))
      .slice(0, 8);

    const items = uniqueItems(itemsFromSections.length ? itemsFromSections : fallbackItems);
    return {
      title: 'Sambhavit Saza',
      items: items.length ? items : ['Is scenario ke liye clear saza details nahi mili.'],
    };
  }

  if (analysisType === 'next_steps') {
    const items = uniqueItems(
      contentLines
        .filter((line) => actionPattern.test(line))
        .slice(0, 8)
        .map((line) => line.replace(/^[-:\s]+/, '').trim())
    );
    return {
      title: 'Ab Kya Karein',
      items: items.length ? items : ['Is scenario ke liye clear actionable steps nahi mile.'],
    };
  }

  return {
    title: 'Analysis',
    items: uniqueItems(contentLines).slice(0, 8),
  };
};

const EXAMPLE_BUTTONS: Array<{ key: ExampleCategory; label: string }> = [
  { key: 'robbery', label: 'Robbery' },
  { key: 'fraud', label: 'Fraud' },
  { key: 'assault', label: 'Assault' },
];

const EXAMPLE_SCENARIOS: Record<ExampleRole, Record<ExampleCategory, string[]>> = {
  self: {
    robbery: [
      'Kal raat meri jewellery shop me do masked log ghus gaye, mujhe knife dikha kar gold ornaments aur cash loot kar bhaag gaye.',
      'Main ATM se paise nikal kar nikal raha tha, tab 3 logon ne gher kar mera bag aur phone chheen liya.',
      'Mere ghar ke bahar car roki gayi, mujhe dhamka kar wallet, chain aur cash le liya gaya.',
      'Main medical store band kar raha tha, tab do log pistol dikha kar din bhar ki sale lekar bhag gaye.',
      'Online delivery dene gaya tha, wahan mujhe dhamka kar parcel ke saath mera wallet bhi loot liya gaya.',
    ],
    fraud: [
      'Mujhe govt job dilane ke naam par 3 lakh rupaye liye gaye aur phir agent ne phone band kar diya.',
      'Maine online product ka full payment kiya, lekin seller ne na product bheja na refund diya.',
      'Maine flat booking ke liye advance diya, baad me pata chala papers fake the aur builder gayab ho gaya.',
      'Mere paas bank officer ban kar call aaya, OTP share karte hi mere account se paise kat gaye.',
      'Investment plan me high return ka promise karke mujhse paise liye aur company office bandh kar diya gaya.',
    ],
    assault: [
      'Road par jhagde me mujhe iron rod se mara gaya jis se mere sar par gehri chot aa gayi.',
      'Traffic dispute me ek driver ne mujhe helmet se baar-baar mara aur mera haath fracture ho gaya.',
      'Mohalle me purani dushmani ke chakkar me 3 logon ne milkar mujhe lathi se peeta.',
      'Land dispute par baat karte waqt padosi ne mujhe dhakka dekar chaku se attack kiya.',
      'Raat ko ghar lautte waqt do logon ne mujhe gher kar punches aur kicks se maara.',
    ],
  },
  witness: {
    robbery: [
      'Mere saamne jewellery shop me do masked log ghus kar guard ko knife se dhamka rahe the aur gold loot kar bhaag gaye.',
      'Main road par tha jab do bikers ne ek aadmi ko rok kar uska bag aur mobile chheen liya.',
      'ATM ke bahar mere saamne teen logon ne ek vyakti ko gher kar usse cash aur wallet le liya.',
      'Showroom ke bahar maine dekha do log owner ko dara kar locker se cash nikalwa kar bhag gaye.',
      'Highway par mere saamne family ki car rok kar unse jewellery aur paise loot liye gaye.',
    ],
    fraud: [
      'Mere saamne mere dost se govt job ke naam par paise liye gaye aur baad me agent gayab ho gaya.',
      'Maine dekha seller ne advance payment lekar fake invoice diya aur product deliver nahi kiya.',
      'Mere saamne property deal me fake papers dikhakar buyer se paise liye gaye.',
      'Office me maine dekha ek aadmi ne bank call ke bahane OTP lekar victim ke account se paise nikale.',
      'Mere saamne local group me investment scam chala kar logon se paisa collect karke organizer bhaag gaya.',
    ],
    assault: [
      'Mere saamne road par jhagde me ek aadmi ne dusre ko iron rod se mara.',
      'Traffic signal par maine dekha ek driver ne dusre driver ko helmet se zor se maara.',
      'Mere saamne teen log milkar ek ladke ko lathi se peet rahe the.',
      'Mohalle me land dispute ke dauran maine padosi ko chaku se hamla karte dekha.',
      'School gate ke paas mere saamne do logon ne ek vyakti ko gher kar maar-peet ki.',
    ],
  },
};

const SCENARIO_MODES = [
  { label: 'Mere Saath Hua', value: 'self' as const },
  { label: 'Mere Saamne Hua', value: 'witness' as const },
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
      gap: Platform.select({ android: 8, default: 12 }),
      marginTop: 18,
      marginBottom: 18,
    },
    optionButton: {
      flex: 1,
      backgroundColor: theme.accent,
      paddingVertical: Platform.select({ android: 12, default: 16 }),
      paddingHorizontal: Platform.select({ android: 8, default: 16 }),
      borderRadius: 14,
      justifyContent: 'center',
      minHeight: Platform.select({ android: 86, default: 0 }),
      ...getShadow(theme, 16, 6, 4, themeModeShadowOpacity(theme)),
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: {
      color: theme.buttonText,
      textAlign: 'center',
      fontWeight: '700',
      fontSize: Platform.select({ android: 13, default: 14 }),
      lineHeight: Platform.select({ android: 18, default: 20 }),
      letterSpacing: Platform.select({ android: 0.2, default: 0.4 }),
      includeFontPadding: false,
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
      flex: 1,
      fontSize: 15,
      color: theme.text,
      lineHeight: 22,
      fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    resultLinesWrap: {
      gap: 8,
    },
    resultItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    resultBullet: {
      color: theme.muted,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '700',
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
