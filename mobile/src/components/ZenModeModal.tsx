/**
 * ZenModeModal — Pro-exclusive immersive focus screen.
 * Fullscreen, distraction-free: drifting aurora orbs, a giant clock and
 * minimal controls. Orb colors follow the equipped cosmetic frame.
 */
import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { msToDisplay } from '../utils/formatTime';
import { getFrameVisual } from '../constants/frames';

const BG = '#050510';
const TEXT = '#e2e8f0';
const MUTED = '#64748b';
const PAUSE_C = '#f59e0b';
const DANGER = '#ef4444';
const DEFAULT_ORBS = ['#00d2ff', '#8b5cf6', '#ff2ec4'];

interface Props {
  visible: boolean;
  onClose: () => void;
  remainingMs: number;
  progress: number;     // 0–1
  isPaused: boolean;
  isLoading: boolean;
  subjectName?: string;
  /** Equipped cosmetic frame — tints the ambient orbs */
  frameId?: string | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

/** One slowly drifting, glowing orb. */
function Orb({
  color,
  size,
  x,
  y,
  driftX,
  driftY,
  duration,
}: {
  color: string;
  size: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  duration: number;
}) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true, // yoyo back and forth
    );
    return () => cancelAnimation(phase);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(phase.value, [0, 1], [0, driftX]) },
      { translateY: interpolate(phase.value, [0, 1], [0, driftY]) },
      { scale: interpolate(phase.value, [0, 1], [1, 1.18]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        style,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: x,
          top: y,
          backgroundColor: `${color}1f`,
          shadowColor: color,
        },
      ]}
    />
  );
}

export function ZenModeModal({
  visible,
  onClose,
  remainingMs,
  progress,
  isPaused,
  isLoading,
  subjectName,
  frameId,
  onPause,
  onResume,
  onStop,
}: Props) {
  const { width, height } = useWindowDimensions();
  const frame = getFrameVisual(frameId);
  const orbColors = frame
    ? [frame.ring, frame.glow, frame.outer2 ?? frame.outer]
    : DEFAULT_ORBS;

  // Gentle breathing on the clock while actively focusing
  const breath = useSharedValue(0);
  useEffect(() => {
    if (visible && !isPaused) {
      breath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 300 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isPaused]);

  const clockStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.015 }],
    opacity: 0.92 + breath.value * 0.08,
  }));

  const accent = isPaused ? PAUSE_C : (frame?.ring ?? '#00d2ff');
  const p = Math.min(1, Math.max(0, progress));

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Ambient layer */}
        <Orb color={orbColors[0]} size={Math.min(width, 380)} x={-width * 0.25} y={-40}
             driftX={60} driftY={90} duration={11000} />
        <Orb color={orbColors[1]} size={Math.min(width, 340)} x={width * 0.45} y={height * 0.3}
             driftX={-70} driftY={-60} duration={14000} />
        <Orb color={orbColors[2]} size={Math.min(width, 300)} x={width * 0.1} y={height * 0.72}
             driftX={50} driftY={-80} duration={9000} />

        {/* Exit */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Center */}
        <View style={styles.center}>
          {subjectName ? (
            <Text style={styles.subject} numberOfLines={1}>{subjectName.toUpperCase()}</Text>
          ) : null}

          <Animated.Text style={[styles.clock, clockStyle, { color: isPaused ? PAUSE_C : TEXT }]}>
            {msToDisplay(remainingMs)}
          </Animated.Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: accent }]} />
            <Text style={[styles.statusText, { color: accent }]}>
              {isPaused ? 'PAUSED' : 'FOCUSING'}
            </Text>
          </View>

          {/* Thin progress line */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${p * 100}%`, backgroundColor: accent }]} />
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.roundBtn, { borderColor: `${accent}55` }]}
            onPress={isPaused ? onResume : onPause}
            disabled={isLoading}
            activeOpacity={0.75}
          >
            {isLoading
              ? <ActivityIndicator color={accent} size="small" />
              : <Text style={[styles.roundBtnText, { color: accent }]}>{isPaused ? '▶' : '⏸'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roundBtn, { borderColor: `${DANGER}55` }]}
            onPress={onStop}
            activeOpacity={0.75}
          >
            <Text style={[styles.roundBtnText, { color: DANGER }]}>■</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 60,
    elevation: 0,
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 28,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  closeText: { color: MUTED, fontSize: 16, fontWeight: '600' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  subject: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 14,
  },
  clock: {
    fontSize: 78,
    fontWeight: '200',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  progressTrack: {
    marginTop: 34,
    width: '72%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 64,
  },
  roundBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  roundBtnText: { fontSize: 20 },
});
