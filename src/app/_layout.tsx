import {
  Fraunces_400Regular,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Component, useEffect, type ReactNode } from 'react';
import { ScrollView, Text, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const dev = typeof __DEV__ !== 'undefined' && __DEV__;
      return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 32 }} style={{ flex: 1, backgroundColor: '#F1FAF5' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#0B2B26', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ fontSize: 15, color: '#5B7771' }}>Please reload the app. If it keeps happening, let us know.</Text>
          {dev && (
            <Text selectable style={{ marginTop: 20, fontSize: 12, color: '#b00020' }}>
              {String(this.state.error.message)}
              {'\n\n'}
              {String(this.state.error.stack)}
            </Text>
          )}
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [loaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: palette.background },
            }}
          />
        </AuthProvider>
      </ErrorBoundary>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </GestureHandlerRootView>
  );
}
