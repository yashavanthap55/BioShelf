import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useReducedMotion } from '../../hooks/motion';
import { useTheme } from '../../theme/ThemeProvider';

const ANCHORS = [
  { x: 0.05, y: 0.02, r: 0.95 },
  { x: 1.0, y: 0.35, r: 0.85 },
  { x: 0.0, y: 0.78, r: 0.8 },
  { x: 0.95, y: 1.0, r: 0.75 },
];

const GRAIN = {
  dark: require('../../../../assets/textures/grain-light.png'),
  light: require('../../../../assets/textures/grain-dark.png'),
};

/**
 * Barely-there light blooms drifting over a deep base, finished with a fine
 * film grain. Painted once behind every route, so all glass blurs the same
 * backdrop.
 */
export function  AuroraBackground() {
  const { tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const drift = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 30_000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 30_000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, reduced]);

  const extent = Math.max(width, height * 0.6);
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.05, width * 0.05] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [height * 0.02, -height * 0.02] });
  // Oversized so the drift never exposes an edge.
  const bleedX = width * 0.1;
  const bleedY = height * 0.1;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <LinearGradient colors={[tokens.backgroundTop, tokens.backgroundBottom]} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={{
          position: 'absolute',
          left: -bleedX,
          top: -bleedY,
          width: width + bleedX * 2,
          height: height + bleedY * 2,
          transform: [{ translateX }, { translateY }],
        }}
      >
        <Svg width={width + bleedX * 2} height={height + bleedY * 2} viewBox={`${-bleedX} ${-bleedY} ${width + bleedX * 2} ${height + bleedY * 2}`}>
          <Defs>
            {tokens.orbs.map((orb, i) => (
              <RadialGradient key={i} id={`bloom${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={orb.color} stopOpacity={orb.opacity} />
                <Stop offset="0.5" stopColor={orb.color} stopOpacity={orb.opacity * 0.35} />
                <Stop offset="1" stopColor={orb.color} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {tokens.orbs.map((_, i) => {
            const a = ANCHORS[i % ANCHORS.length];
            return <Circle key={i} cx={width * a.x} cy={height * a.y} r={extent * a.r} fill={`url(#bloom${i})`} />;
          })}
        </Svg>
      </Animated.View>
      <Image source={GRAIN[tokens.scheme]} resizeMode="repeat" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: tokens.grainOpacity }]} />
    </View>
  );
}
