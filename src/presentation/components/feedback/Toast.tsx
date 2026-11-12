import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { DARK } from '../../theme/tokens';
import { Txt } from '../Txt';

interface ToastMessage {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastApi {
  show(message: string): void;
  /** Snackbar with an Undo action for the command that just ran. */
  showUndo(message: string, onUndo: () => void): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const nextId = useRef(1);

  const push = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    setToast({ id: nextId.current++, message, actionLabel, onAction });
  }, []);

  const api: ToastApi = {
    show: (message) => push(message),
    showUndo: (message, onUndo) => push(message, 'Undo', onUndo),
  };

  return (
    <ToastContext value={api}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDone={() => setToast(null)} /> : null}
    </ToastContext>
  );
}

function ToastView({ toast, onDone }: { toast: ToastMessage; onDone: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const appear = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(appear, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDone);
    }, 5000);
    return () => clearTimeout(timer);
  }, [appear, onDone]);

  return (
    <Animated.View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 104,
        alignItems: 'center',
        opacity: appear,
        transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 440,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 18,
          paddingRight: toast.actionLabel ? 8 : 18,
          paddingVertical: 12,
          borderRadius: 16,
          backgroundColor: tokens.scheme === 'dark' ? 'rgba(26,28,33,0.97)' : 'rgba(27,25,21,0.96)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Txt variant="body" color="#F3EFE7" style={{ flex: 1 }}>
          {toast.message}
        </Txt>
        {toast.actionLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              toast.onAction?.();
              onDone();
            }}
            style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}
          >
            <Txt variant="label" color={DARK.accent}>
              {toast.actionLabel}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
