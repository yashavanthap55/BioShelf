import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton, SecondaryButton, TextButton } from '../../components/glass/Controls';
import { GlassView } from '../../components/glass/GlassView';
import { Icon } from '../../components/Icon';
import { Txt } from '../../components/Txt';
import { useReducedMotion } from '../../hooks/motion';
import type { IconName } from '../../theme/categoryStyle';
import { useTheme } from '../../theme/ThemeProvider';
import { withAlpha } from '../../theme/tokens';
import type { ScanStatus } from './formState';

/** Photo of the wrapper / carton, with its automatic label-reading status. */
export function LabelPhotoSection({
  photoUri,
  hasPhoto,
  status,
  message,
  canScan,
  onCamera,
  onUpload,
  onRescan,
  onRemove,
  onUndoAutoFill,
}: {
  photoUri: string | null;
  hasPhoto: boolean;
  status: ScanStatus;
  message?: string;
  canScan: boolean;
  onCamera: () => void;
  onUpload: () => void;
  onRescan: () => void;
  onRemove: () => void;
  onUndoAutoFill?: () => void;
}) {
  const { tokens } = useTheme();
  const reading = status === 'reading';

  if (!hasPhoto) {
    return (
      <GlassView radius={28} style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: withAlpha(tokens.accent, 0.55), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="document-scanner" size={20} color={tokens.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="title">Scan the label</Txt>
            <Txt variant="bodySmall" style={{ marginTop: 2 }}>
              Photograph the wrapper or carton. Name, batch, dates and storage are filled in for you.
            </Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
          <PrimaryButton label="Camera" icon="photo-camera" height={48} onPress={onCamera} style={{ flex: 1 }} testID="photo-camera" />
          <SecondaryButton label="Upload" icon="file-upload" height={48} onPress={onUpload} style={{ flex: 1 }} />
        </View>
      </GlassView>
    );
  }

  const bannerColor = status === 'done' ? tokens.safe : status === 'failed' ? tokens.warning : tokens.accent;

  return (
    <View>
      <GlassView radius={28} style={{ padding: 8 }}>
        <View style={{ borderRadius: 21, overflow: 'hidden', aspectRatio: 4 / 3 }}>
          {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          {reading ? <ScanningOverlay /> : null}
          <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 }}>
            {canScan ? <PhotoAction icon="document-scanner" label="Read label again" disabled={reading} onPress={onRescan} /> : null}
            <PhotoAction icon="photo-library" label="Replace photo" disabled={reading} onPress={onUpload} />
            <PhotoAction icon="close" label="Remove photo" disabled={reading} onPress={onRemove} />
          </View>
        </View>
      </GlassView>
      {message && !reading ? (
        <GlassView blur={false} radius={18} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: onUndoAutoFill ? 8 : 16, paddingVertical: 10 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: bannerColor }} />
          <Txt variant="bodySmall" color={tokens.textPrimary} style={{ flex: 1 }}>
            {message}
          </Txt>
          {onUndoAutoFill ? <TextButton label="Undo" onPress={onUndoAutoFill} /> : null}
        </GlassView>
      ) : null}
    </View>
  );
}

function PhotoAction({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={18} color="#FFFFFF" />
    </Pressable>
  );
}

/** Veil with a slow champagne scan line while OCR runs. */
function ScanningOverlay() {
  const { tokens } = useTheme();
  const reduced = useReducedMotion();
  const sweep = useState(() => new Animated.Value(0.5))[0];

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0.5, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, sweep]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
      <Animated.View
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          top: '8%',
          height: 1.5,
          backgroundColor: tokens.accent,
          opacity: 0.9,
          transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) }],
        }}
      />
      <View style={{ position: 'absolute', bottom: 18, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Txt variant="labelMedium" color="#FFFFFF" style={{ letterSpacing: 0.4 }}>
          Reading label…
        </Txt>
      </View>
    </View>
  );
}
