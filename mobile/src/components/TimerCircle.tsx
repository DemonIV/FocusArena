/**
 * TimerCircle — animated progress ring without react-native-svg.
 *
 * Technique: two half-disc slots (left clip + right clip), each containing a
 * full-size disc whose right half is colored and left half is transparent.
 *
 * Right disc: starts at 180° (colored half facing LEFT → hidden by right clip).
 *   Rotates toward 0° to reveal the right arc (0 → 50% of total progress).
 * Left disc: starts at 0° (colored half facing RIGHT → hidden by left clip).
 *   Rotates toward 180° CW to reveal the left arc (50 → 100% of total progress).
 * A solid inner circle (background color) creates the ring cutout.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { msToDisplay } from '../utils/formatTime';

const SIZE = 240;
const STROKE = 16;
const HALF = SIZE / 2;
const INNER_SIZE = SIZE - STROKE * 2;

const TRACK_COLOR = '#1a2a3a';
const HOLE_COLOR = '#1a1a2e'; // matches screen background

interface Props {
  progress: number;   // 0–1
  remainingMs: number;
  isActive: boolean;
  isPaused: boolean;
}

export function TimerCircle({ progress, remainingMs, isActive, isPaused }: Props) {
  const p = Math.min(1, Math.max(0, progress));

  // Right disc: 180° (hidden) → 0° (fully visible right arc) for progress 0→50%
  const targetRight = p <= 0.5 ? 180 - p * 2 * 180 : 0;
  // Left disc: 0° (hidden) → 180° (fully visible left arc) for progress 50→100%
  const targetLeft  = p > 0.5 ? (p - 0.5) * 2 * 180 : 0;

  const rightRot = useSharedValue(180);
  const leftRot  = useSharedValue(0);

  useEffect(() => {
    const dur = 500;
    const ease = Easing.out(Easing.quad);
    rightRot.value = withTiming(targetRight, { duration: dur, easing: ease });
    leftRot.value  = withTiming(targetLeft,  { duration: dur, easing: ease });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  const rightAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rightRot.value}deg` }],
  }));
  const leftAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leftRot.value}deg` }],
  }));

  const fillColor = !isActive ? '#3a3a5a' : isPaused ? '#e94560' : '#00d2ff';
  const statusLabel = !isActive ? 'READY' : isPaused ? 'PAUSED' : 'FOCUSING';

  return (
    <View style={styles.wrapper}>
      {/* Track ring (always visible, background color) */}
      <View style={[styles.trackRing]} />

      {/* ── Right progress arc (0%–50%) ── */}
      {/* Clip: shows only right half of the disc */}
      <View style={[styles.clip, styles.rightClip]}>
        {/* Full disc; only right half is colored → rotates to reveal it in right clip */}
        <Animated.View style={[styles.disc, styles.rightDisc, rightAnimStyle]}>
          <View style={[styles.halfColor, { backgroundColor: fillColor }]} />
        </Animated.View>
      </View>

      {/* ── Left progress arc (50%–100%) ── */}
      <View style={[styles.clip, styles.leftClip]}>
        <Animated.View style={[styles.disc, styles.leftDisc, leftAnimStyle]}>
          <View style={[styles.halfColor, { backgroundColor: fillColor }]} />
        </Animated.View>
      </View>

      {/* Inner hole — creates the ring cutout over the solid discs */}
      <View style={styles.hole} />

      {/* Text */}
      <View style={styles.content}>
        <Text style={[styles.timeText, { color: fillColor }]}>
          {msToDisplay(remainingMs)}
        </Text>
        <Text style={[styles.statusText, { color: fillColor }]}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Full-circle track ring
  trackRing: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: HALF,
    borderWidth: STROKE,
    borderColor: TRACK_COLOR,
  },

  // Each clip is half the wrapper width, overflow hidden
  clip: {
    position: 'absolute',
    width: HALF,
    height: SIZE,
    overflow: 'hidden',
  },
  rightClip: { left: HALF },   // shows x from HALF to SIZE in wrapper
  leftClip:  { left: 0 },      // shows x from 0 to HALF in wrapper

  // Full SIZE disc centered on the wrapper center — positioned inside clip
  disc: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: HALF,
    top: 0,
  },
  // Right clip starts at x=HALF in wrapper. Disc left=-HALF → disc starts at 0 in wrapper → center=HALF ✓
  rightDisc: { left: -HALF },
  // Left clip starts at x=0 in wrapper. Disc left=0 → disc starts at 0 in wrapper → center=HALF ✓
  leftDisc:  { left: 0 },

  // The colored right half of the disc (left half is transparent → default background)
  halfColor: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: HALF,
    height: SIZE,
  },

  // Solid hole circle to cut out the center → ring illusion
  hole: {
    position: 'absolute',
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    backgroundColor: HOLE_COLOR,
  },

  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3,
    marginTop: 4,
    opacity: 0.8,
  },
});
