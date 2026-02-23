import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore when splash has already been handled by the platform.
});

const SPLASH_BG = '#2D4F8C';

function AnimatedSplash({ onComplete }: { onComplete: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1040,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 1040,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setTimeout(onComplete, 260);
      }
    });
  }, [onComplete, opacity, scale]);

  return (
    <View style={styles.splashContainer} pointerEvents="none">
      <Animated.View style={[styles.splashContent, { opacity, transform: [{ scale }] }]}>
        <View style={styles.logoFrame}>
          <Image source={require('../assets/images/app icon.jpeg')} style={styles.logo} />
        </View>
        <Text style={styles.tagline}>Justice • Liberty • Equality</Text>
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  const { theme } = useTheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [showSplashOverlay, setShowSplashOverlay] = useState(true);

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  const handleSplashComplete = useCallback(() => {
    setShowSplashOverlay(false);
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={styles.root}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        {showSplashOverlay && <AnimatedSplash onComplete={handleSplashComplete} />}
      </View>
      <StatusBar style="light" hidden />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  splashContent: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  logoFrame: {
    width: 176,
    height: 176,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 241, 255, 0.26)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  logo: {
    width: 156,
    height: 156,
    borderRadius: 28,
  },
  tagline: {
    color: 'rgba(229, 239, 255, 0.9)',
    fontSize: 13,
    letterSpacing: 1.1,
    fontWeight: '400',
    textAlign: 'center',
  },
});
