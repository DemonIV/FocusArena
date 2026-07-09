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
import { getFrameVisual } from '../constants/frames';

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
  /** Equipped cosmetic frame id (shop) — undefined/null = default look */
  frameId?: string | null;
  /**
   * When idle, preview this session length in the ring (ms) instead of a dead
   * 00:00 — e.g. a 25-min selection reads "25:00", charged and ready to go.
   */
  idleMs?: number;
}

export function TimerCircle({ progress, remainingMs, isActive, isPaused, frameId, idleMs }: Props) {
  const frame = getFrameVisual(frameId);

  // Pro frames: slow orbiting highlight on the outer ring.
  const orbit = useSharedValue(0);
  useEffect(() => {
    if (frame?.animated) {
      orbit.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(orbit);
      orbit.value = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.animated]);
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value}deg` }],
  }));
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

  // Frame overrides the focusing colors; paused stays amber for clarity.
  const PAUSE_AMBER = '#f59e0b';
  const focusRing = frame?.ring ?? '#00d2ff';
  const focusGlow = frame?.glow ?? '#00d2ff';
  // Idle is a charged, inviting state — show the brand accent, not a dead grey.
  const fillColor = isPaused ? PAUSE_AMBER : focusRing;
  const glowColor = isPaused ? PAUSE_AMBER : focusGlow;
  const statusLabel = !isActive ? 'READY' : isPaused ? 'PAUSED' : 'FOCUSING';

  // Idle previews the chosen length (25:00), so the ring never looks empty.
  const displayMs = !isActive && idleMs != null ? idleMs : remainingMs;

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
      {/* Cosmetic frame — decorative outer ring(s), visible even when idle */}
      {frame && (
        <>
          <View style={[styles.frameRing, {
            borderColor: `${frame.outer}66`,
            shadowColor: frame.outer,
          }]} />
          {frame.outer2 && (
            <View style={[styles.frameRing2, { borderColor: `${frame.outer2}55` }]} />
          )}
          {/* Pro frames: orbiting comet highlight */}
          {frame.animated && (
            <Animated.View style={[styles.orbitRing, orbitStyle, {
              borderTopColor: frame.outer,
              borderRightColor: `${frame.outer2 ?? frame.outer}88`,
            }]} />
          )}
        </>
      )}

      {/* Glow ring behind the circle — breathes while focusing */}
      {isActive ? (
        <Animated.View style={[styles.glowRing, glowAnimStyle, {
          shadowColor: glowColor,
          borderColor: `${glowColor}22`,
        }]} />
      ) : (
        // Idle: a calm, static glow so the ring feels ready, not switched off.
        <View style={[styles.glowRing, styles.idleGlow, {
          shadowColor: focusGlow,
          borderColor: `${focusRing}1a`,
        }]} />
      )}

      <View style={styles.wrapper}>
        {/* Track ring — charged accent tint when idle, faint when running */}
        <View style={[styles.trackRing, !isActive && { borderColor: `${focusRing}26` }]} />

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
            {msToDisplay(displayMs)}
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
    width: SIZE + 48,
    height: SIZE + 48,
  },
  frameRing: {
    position: 'absolute',
    width: SIZE + 32,
    height: SIZE + 32,
    borderRadius: (SIZE + 32) / 2,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  frameRing2: {
    position: 'absolute',
    width: SIZE + 44,
    height: SIZE + 44,
    borderRadius: (SIZE + 44) / 2,
    borderWidth: 1.5,
  },
  orbitRing: {
    position: 'absolute',
    width: SIZE + 32,
    height: SIZE + 32,
    borderRadius: (SIZE + 32) / 2,
    borderWidth: 3,
    borderColor: 'transparent',
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
  idleGlow: {
    opacity: 0.9,
    shadowOpacity: 0.22,
    shadowRadius: 18,
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
