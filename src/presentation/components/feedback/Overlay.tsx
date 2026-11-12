import { BlurView } from 'expo-blur';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';

export type OverlayKind = 'dialog' | 'sheet' | 'fullscreen';

type Render = (close: (value: unknown) => void) => ReactNode;

interface Entry {
  id: number;
  kind: OverlayKind;
  render: Render;
  dismissValue: unknown;
  resolve: (value: unknown) => void;
}

interface OverlayApi {
  open<T>(kind: OverlayKind, render: (close: (value: T) => void) => ReactNode, dismissValue: T): Promise<T>;
}

const OverlayContext = createContext<OverlayApi | null>(null);

/**
 * Hosts dialogs, sheets and viewers inside the app's root view (rather than
 * native modals) so they share the glass backdrop and stay inside the phone
 * frame on wide web screens. Android's back button closes the top layer.
 */
export function OverlayProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const nextId = useRef(1);

  const close = useCallback((id: number, value: unknown) => {
    setEntries((current) => {
      const entry = current.find((e) => e.id === id);
      entry?.resolve(value);
      return current.filter((e) => e.id !== id);
    });
  }, []);

  const open = useCallback<OverlayApi['open']>((kind, render, dismissValue) => {
    return new Promise((resolve) => {
      const id = nextId.current++;
      setEntries((current) => [
        ...current,
        { id, kind, render: render as Render, dismissValue, resolve: resolve as (value: unknown) => void },
      ]);
    });
  }, []);

  useEffect(() => {
    if (entries.length === 0) return;
    const top = entries[entries.length - 1];
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close(top.id, top.dismissValue);
      return true;
    });
    return () => subscription.remove();
  }, [entries, close]);

  return (
    <OverlayContext value={{ open }}>
      {children}
      {entries.map((entry) => (
        <OverlayLayer key={entry.id} entry={entry} onClose={(value) => close(entry.id, value)} />
      ))}
    </OverlayContext>
  );
}

function OverlayLayer({ entry, onClose }: { entry: Entry; onClose: (value: unknown) => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const appear = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [appear]);

  const translateY = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [entry.kind === 'sheet' ? 60 : 12, 0],
  });
  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [entry.kind === 'dialog' ? 0.96 : 1, 1] });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]}>
        {Platform.OS !== 'android' ? (
          <BlurView intensity={18} tint={tokens.blurTint} style={StyleSheet.absoluteFill} />
        ) : null}
        <Pressable
          accessibilityLabel="Dismiss"
          style={[StyleSheet.absoluteFill, { backgroundColor: entry.kind === 'fullscreen' ? 'rgba(0,0,0,0.92)' : tokens.scrim }]}
          onPress={() => onClose(entry.dismissValue)}
        />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          entry.kind === 'dialog' && { justifyContent: 'center', padding: 24 },
          entry.kind === 'sheet' && { justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: insets.bottom + 10 },
        ]}
      >
        <Animated.View
          pointerEvents="box-none"
          style={[
            entry.kind === 'fullscreen' ? StyleSheet.absoluteFill : null,
            entry.kind === 'dialog' && { alignSelf: 'center', width: '100%', maxWidth: 420 },
            { opacity: appear, transform: [{ translateY }, { scale }] },
          ]}
        >
          {entry.render(onClose)}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function useOverlay(): OverlayApi {
  const api = useContext(OverlayContext);
  if (!api) throw new Error('useOverlay must be used inside <OverlayProvider>');
  return api;
}
