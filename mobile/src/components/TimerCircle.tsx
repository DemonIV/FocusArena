/**
 * TimerCircle — animated progress ring without react-native-svg.
 * Two half-disc technique + glow shadow effect.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { msToDisplay } from '../utils/formatTime';

const SIZE = 220;
const STROKE = 14;
const HALF = SIZE / 2;
const INNER_SIZE = SIZE - STROKE * 2;

const TRACK_COLOR = 'rgba(255,255,255,0.06)';
const HOLE_COLOR = '#0d0d1a';

interface Props {
  progress: number;   // 0–1
  remainingMs: number;
  isActive: boolean;
  isPaused: boolean;
}

export function TimerCircle({ progress, remainingMs, isActive, isPaused }: Props) {
  const p = Math.min(1, Math.max(0, progress));

  const targetRight = p <= 0.5 ? 180 - p * 2 * 180 : 0;
  const targetLeft  = p > 0.5 ? (p - 0.5) * 2 * 180 : 0;

  const rightRot = useSharedValue(180);
  const leftRot  = useSharedValue(0);

  // Breathing pulse — only while actively focusing (not paused / idle)
  const pulse = useSharedValue(0);

  useEffect(() => {
    const dur = 600;
    const ease = Easing.out(Easing.cubic);
    rightRot.value = withTiming(targetRight, { duration: dur, easing: ease });
    leftRot.value  = withTiming(targetLeft,  { duration: dur, easing: ease });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  useEffect(() => {
    if (isActive && !isPaused) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 300 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isPaused]);

  const fillColor = !isActive ? '#4a4a6a' : isPaused ? '#f59e0b' : '#00d2ff';
  const glowColor = !isActive ? 'transparent' : isPaused ? '#f59e0b' : '#00d2ff';
  const statusLabel = !isActive ? 'READY' : isPaused ? 'PAUSED' : 'FOCUSING';

  const rightAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rightRot.value}deg` }],
  }));
  const leftAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leftRot.value}deg` }],
  }));
  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.04 }],
  }));

  return (
    <View style={styles.outerWrapper}>
      {/* Glow ring behind the circle — breathes while focusing */}
      {isActive && (
        <Animated.View style={[styles.glowRing, glowAnimStyle, {
          shadowColor: glowColor,
          borderColor: `${glowColor}22`,
        }]} />
      )}

      <View style={styles.wrapper}>
        {/* Track ring */}
        <View style={styles.trackRing} />

        {/* Right arc (0%–50%) */}
        <View style={[styles.clip, styles.rightClip]}>
          <Animated.View style={[styles.disc, styles.rightDisc, rightAnimStyle]}>
            <View style={[styles.halfColor, { backgroundColor: fillColor }]} />
          </Animated.View>
        </View>

        {/* Left arc (50%–100%) */}
        <View style={[styles.clip, styles.leftClip]}>
          <Animated.View style={[styles.disc, styles.leftDisc, leftAnimStyle]}>
            <View style={[styles.halfColor, { backgroundColor: fillColor }]} />
          </Animated.View>
        </View>

        {/* Inner hole */}
        <View style={styles.hole} />

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.timeText, { color: fillColor }]}>
            {msToDisplay(remainingMs)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${glowColor}18` }]}>
            <Text style={[styles.statusText, { color: fillColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZE + 40,
    height: SIZE + 40,
  },
  glowRing: {
    position: 'absolute',
    width: SIZE + 20,
    height: SIZE + 20,
    borderRadius: (SIZE + 20) / 2,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackRing: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: HALF,
    borderWidth: STROKE,
    borderColor: TRACK_COLOR,
  },
  clip: {
    position: 'absolute',
    width: HALF,
    height: SIZE,
    overflow: 'hidden',
  },
  rightClip: { left: HALF },
  leftClip:  { left: 0 },
  disc: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: HALF,
    top: 0,
  },
  rightDisc: { left: -HALF },
  leftDisc:  { left: 0 },
  halfColor: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: HALF,
    height: SIZE,
  },
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
    gap: 8,
  },
  timeText: {
    fontSize: 46,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
