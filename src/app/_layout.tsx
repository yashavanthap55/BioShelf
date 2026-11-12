import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { configureDependencies, createAppServices, type AppServices } from '@/core/bootstrap';
import { Txt } from '@/presentation/components/Txt';
import { DeviceFrame } from '@/presentation/components/DeviceFrame';
import { OverlayProvider } from '@/presentation/components/feedback/Overlay';
import { ToastProvider } from '@/presentation/components/feedback/Toast';
import { AuroraBackground } from '@/presentation/components/glass/AuroraBackground';
import { ServicesProvider, useSettings } from '@/presentation/hooks/useAppServices';
import { ThemeProvider, useTheme } from '@/presentation/theme/ThemeProvider';
import { DARK } from '@/presentation/theme/tokens';
import { FONT_FILES } from '@/presentation/theme/typography';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const [services, setServices] = useState<AppServices | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await configureDependencies();
        setServices(await createAppServices());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const ready = (fontsLoaded || fontError) && (services || error);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  if (!services) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: DARK.backgroundTop }}>
        <Txt style={{ color: DARK.textPrimary, textAlign: 'center' }}>BioShelf could not start: {error}</Txt>
      </View>
    );
  }

  return (
    <ServicesProvider services={services}>
      <ThemedApp />
    </ServicesProvider>
  );
}

function ThemedApp() {
  const { state: settings } = useSettings();
  return (
    <ThemeProvider preference={settings.themePreference}>
      <AppChrome />
    </ThemeProvider>
  );
}

/** One shared backdrop behind every (transparent) route. */
function AppChrome() {
  const { tokens } = useTheme();
  const base = tokens.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, background: 'transparent', card: 'transparent', primary: tokens.accent },
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.backgroundTop }}>
      <StatusBar style={tokens.scheme === 'dark' ? 'light' : 'dark'} />
      <AuroraBackground />
      <DeviceFrame>
        <NavigationThemeProvider value={navigationTheme}>
          <OverlayProvider>
            <ToastProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                  animation: 'fade',
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="asset/[id]" options={{ animation: 'fade_from_bottom' }} />
                <Stack.Screen name="asset-form" options={{ animation: 'slide_from_bottom' }} />
              </Stack>
            </ToastProvider>
          </OverlayProvider>
        </NavigationThemeProvider>
      </DeviceFrame>
    </View>
  );
}
