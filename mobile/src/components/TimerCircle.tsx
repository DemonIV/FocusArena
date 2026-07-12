/**
 * TimerCircle — "nebula reactor" progress ring.
 *
 * SVG gradient arc with a synced comet head, a slowly turning tick bezel,
 * orbiting fireflies and a layered breathing aura. The aura tempo doubles in
 * the final minute; starting a session fires a spring + shockwave "ignition".
 * Ambient motion respects the system reduce-motion setting; pausing freezes
 * the machinery (amber, fireflies gone, bezel stopped).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated';
import { msToDisplay } from '../utils/formatTime';
import { getFrameVisual } from '../constants/frames';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 220;
const STROKE = 14;
const HALF = SIZE / 2;
const R = HALF - STROKE / 2;                 // arc radius (stroke centered)
const CIRCUMFERENCE = 2 * Math.PI * R;

const TRACK_COLOR = 'rgba(255,255,255,0.06)';
const PAUSE_AMBER = '#f59e0b';
const DEFAULT_RING = '#00d2ff';
const DEFAULT_GRAD_END = '#8b5cf6';          // brand cyan melts into violet

// Comet head riding the arc tip
const COMET = STROKE + 6;

// Tick bezel (instrument dial between the digits and the arc)
const TICK_OUTER = HALF - STROKE - 5;
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i * 6 * Math.PI) / 180;
  const major = i % 5 === 0;
  const len = major ? 7 : 4;
  return {
    major,
    x1: HALF + Math.sin(a) * TICK_OUTER,
    y1: HALF - Math.cos(a) * TICK_OUTER,
    x2: HALF + Math.sin(a) * (TICK_OUTER - len),
    y2: HALF - Math.cos(a) * (TICK_OUTER - len),
  };
});

// Orbiting fireflies — radius offset, size, orbit duration, direction, twinkle
// delay and peak opacity. Deterministic so the field looks composed, not random.
const FIREFLIES = [
  { r: HALF + 6,  size: 5,   dur: 7000,  dir: 1,  delay: 0,    op: 0.9  },
  { r: HALF + 15, size: 3,   dur: 11000, dir: -1, delay: 400,  op: 0.7  },
  { r: HALF + 10, size: 4,   dur: 9000,  dir: 1,  delay: 900,  op: 0.8  },
  { r: HALF + 19, size: 3,   dur: 14000, dir: -1, delay: 1500, op: 0.6  },
  { r: HALF + 8,  size: 2.5, dur: 6000,  dir: -1, delay: 2100, op: 0.75 },
  { r: HALF + 17, size: 4.5, dur: 12000, dir: 1,  delay: 600,  op: 0.85 },
] as const;

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

/** One particle orbiting the ring — own carrier rotation + twinkle loop. */
function Firefly({
  r, size, dur, dir, delay, op, index, color,
}: (typeof FIREFLIES)[number] & { index: number; color: string }) {
  const rot = useSharedValue(0);
  const twinkle = useSharedValue(op * 0.4);

  useEffect(() => {
    const start = (index * 61) % 360;
    rot.value = start;
    rot.value = withRepeat(
      withTiming(start + 360 * dir, { duration: dur, easing: Easing.linear }),
      -1,
      false,
    );
    twinkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(op, { duration: dur / 3, easing: Easing.inOut(Easing.ease) }),
          withTiming(op * 0.25, { duration: dur / 3, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(rot);
      cancelAnimation(twinkle);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carrierStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: twinkle.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(700)}
      exiting={FadeOut.duration(350)}
      style={[
        styles.fireflyCarrier,
        { width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r },
        carrierStyle,
      ]}
    >
      <Animated.View
        style={[
          styles.firefly,
          dotStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            top: -size / 2,
            marginLeft: -size / 2,
            backgroundColor: color,
            shadowColor: color,
          },
        ]}
      />
    </Animated.View>
  );
}

export function TimerCircle({ progress, remainingMs, isActive, isPaused, frameId, idleMs }: Props) {
  const frame = getFrameVisual(frameId);
  const reduceMotion = useReducedMotion();

  // Frame overrides the focusing colors; paused stays amber for clarity.
  const focusRing = frame?.ring ?? DEFAULT_RING;
  const focusGlow = frame?.glow ?? DEFAULT_RING;
  // The arc melts from the ring color into a second hue — frames with a
  // distinct glow/outer2 get their own gradient automatically.
  const gradEnd = frame ? (frame.outer2 ?? frame.glow) : DEFAULT_GRAD_END;
  const fillColor = isPaused ? PAUSE_AMBER : focusRing;
  const gradEndColor = isPaused ? PAUSE_AMBER : gradEnd;
  const glowColor = isPaused ? PAUSE_AMBER : focusGlow;
  const statusLabel = !isActive ? 'READY' : isPaused ? 'PAUSED' : 'FOCUSING';

  const focusing = isActive && !isPaused;
  const finalMinute = focusing && remainingMs > 0 && remainingMs <= 60_000;

  // Idle previews the chosen length (25:00), so the ring never looks empty.
  const displayMs = !isActive && idleMs != null ? idleMs : remainingMs;

  const p = Math.min(1, Math.max(0, progress));

  // ── Progress arc + comet head (one shared value keeps them in lockstep) ──
  const pAnim = useSharedValue(0);
  useEffect(() => {
    pAnim.value = withTiming(p, { duration: 600, easing: Easing.out(Easing.cubic) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - pAnim.value),
  }));
  const cometCarrierStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${pAnim.value * 360}deg` }],
  }));
  const cometStyle = useAnimatedStyle(() => ({
    // Hidden until the arc actually leaves the top notch.
    opacity: pAnim.value > 0.004 ? 1 : 0,
  }));

  // ── Breathing aura, two layers out of phase; tempo doubles at the end ──
  const pulseA = useSharedValue(0);
  const pulseB = useSharedValue(0);
  useEffect(() => {
    if (focusing && !reduceMotion) {
      const dur = finalMinute ? 800 : 1800;
      const ease = Easing.inOut(Easing.ease);
      pulseA.value = withRepeat(
        withSequence(withTiming(1, { duration: dur, easing: ease }), withTiming(0, { duration: dur, easing: ease })),
        -1,
        false,
      );
      pulseB.value = withDelay(
        dur * 0.5,
        withRepeat(
          withSequence(withTiming(1, { duration: dur, easing: ease }), withTiming(0, { duration: dur, easing: ease })),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(pulseA);
      cancelAnimation(pulseB);
      pulseA.value = withTiming(0, { duration: 300 });
      pulseB.value = withTiming(0, { duration: 300 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusing, finalMinute, reduceMotion]);

  const auraAStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + pulseA.value * 0.5,
    transform: [{ scale: 1 + pulseA.value * 0.045 }],
  }));
  const auraBStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pulseB.value * 0.3,
    transform: [{ scale: 1 + pulseB.value * 0.075 }],
  }));

  // ── Tick bezel — slow machinery turn while focusing, ultra slow when idle ──
  const bezel = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || isPaused) {
      cancelAnimation(bezel); // paused: freeze in place, don't snap back
      return;
    }
    const dur = focusing ? 60_000 : 240_000;
    bezel.value = withRepeat(withTiming(bezel.value + 360, { duration: dur, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(bezel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusing, isPaused, reduceMotion]);
  const bezelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bezel.value}deg` }],
  }));

  // ── Idle sheen — a highlight sweeping the charged ring ──
  const sheen = useSharedValue(0);
  useEffect(() => {
    if (!isActive && !reduceMotion) {
      sheen.value = 0;
      sheen.value = withRepeat(withTiming(360, { duration: 3600, easing: Easing.inOut(Easing.quad) }), -1, false);
    } else {
      cancelAnimation(sheen);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, reduceMotion]);
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sheen.value}deg` }],
  }));

  // ── Ignition — spring scale + expanding shockwave when a session starts ──
  const ignition = useSharedValue(1);
  const shockwave = useSharedValue(1); // rests at 1 (invisible)
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActive.current) {
      ignition.value = 0.9;
      ignition.value = withSpring(1, { damping: 9, stiffness: 140 });
      if (!reduceMotion) {
        shockwave.value = 0;
        shockwave.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) });
      }
    }
    wasActive.current = isActive;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, reduceMotion]);
  const ignitionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ignition.value }],
  }));
  const shockwaveStyle = useAnimatedStyle(() => ({
    opacity: (1 - shockwave.value) * 0.75,
    transform: [{ scale: 1 + shockwave.value * 0.45 }],
  }));

  // Pro frames: slow orbiting highlight on the decorative outer ring.
  const orbit = useSharedValue(0);
  useEffect(() => {
    if (frame?.animated && !reduceMotion) {
      orbit.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(orbit);
      orbit.value = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.animated, reduceMotion]);
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value}deg` }],
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
          {frame.animated && (
            <Animated.View style={[styles.orbitRing, orbitStyle, {
              borderTopColor: frame.outer,
              borderRightColor: `${frame.outer2 ?? frame.outer}88`,
            }]} />
          )}
        </>
      )}

      {/* Fireflies — the energy field only exists while actually focusing */}
      {focusing && !reduceMotion && FIREFLIES.map((f, i) => (
        <Firefly key={i} {...f} index={i} color={i % 2 === 0 ? focusGlow : gradEnd} />
      ))}

      {/* Layered breathing aura */}
      <Animated.View
        pointerEvents="none"
        style={[styles.auraRing, auraAStyle, {
          shadowColor: glowColor,
          borderColor: `${glowColor}22`,
        }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.auraRingOuter, auraBStyle, {
          shadowColor: gradEndColor,
          borderColor: `${gradEndColor}18`,
        }]}
      />
      {!isActive && (
        // Idle: a calm static glow so the ring feels charged, not switched off.
        <View style={[styles.auraRing, styles.idleGlow, {
          shadowColor: focusGlow,
          borderColor: `${focusRing}1a`,
        }]} />
      )}

      {/* Ignition shockwave — one-shot expanding ring on session start */}
      <Animated.View
        pointerEvents="none"
        style={[styles.shockwave, shockwaveStyle, { borderColor: glowColor, shadowColor: glowColor }]}
      />

      <Animated.View style={[styles.wrapper, ignitionStyle]}>
        {/* Track + gradient progress arc */}
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={fillColor} />
              <Stop offset="1" stopColor={gradEndColor} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={HALF}
            cy={HALF}
            r={R}
            stroke={!isActive ? `${focusRing}26` : TRACK_COLOR}
            strokeWidth={STROKE}
            fill="none"
          />
          <G rotation={-90} origin={`${HALF}, ${HALF}`}>
            <AnimatedCircle
              cx={HALF}
              cy={HALF}
              r={R}
              stroke="url(#arcGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              animatedProps={arcProps}
              fill="none"
            />
          </G>
        </Svg>

        {/* Tick bezel — instrument dial just inside the arc */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, bezelStyle]}>
          <Svg width={SIZE} height={SIZE}>
            {TICKS.map((tk, i) => (
              <Line
                key={i}
                x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2}
                stroke={tk.major ? `${fillColor}4d` : 'rgba(255,255,255,0.10)'}
                strokeWidth={tk.major ? 2 : 1}
                strokeLinecap="round"
              />
            ))}
          </Svg>
        </Animated.View>

        {/* Idle sheen — a soft highlight sweeping the charged ring */}
        {!isActive && !reduceMotion && (
          <Animated.View
            pointerEvents="none"
            style={[styles.sheenRing, sheenStyle, { borderTopColor: `${focusRing}59` }]}
          />
        )}

        {/* Comet head riding the arc tip (rotation synced with the arc) */}
        {isActive && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, cometCarrierStyle]}>
            <Animated.View style={[styles.cometHalo, cometStyle, { shadowColor: glowColor, backgroundColor: `${glowColor}33` }]} />
            <Animated.View style={[styles.cometCore, cometStyle]} />
          </Animated.View>
        )}

        {/* Content */}
        <View style={styles.content}>
          <Text
            style={[styles.timeText, {
              color: fillColor,
              textShadowColor: `${glowColor}59`,
            }]}
          >
            {msToDisplay(displayMs)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${glowColor}18` }]}>
            <Text style={[styles.statusText, { color: fillColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
      </Animated.View>
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
  auraRing: {
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
  auraRingOuter: {
    position: 'absolute',
    width: SIZE + 36,
    height: SIZE + 36,
    borderRadius: (SIZE + 36) / 2,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  idleGlow: {
    opacity: 0.9,
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  shockwave: {
    position: 'absolute',
    width: SIZE + 8,
    height: SIZE + 8,
    borderRadius: (SIZE + 8) / 2,
    borderWidth: 2,
    opacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  fireflyCarrier: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    alignItems: 'center',
  },
  firefly: {
    position: 'absolute',
    left: '50%',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheenRing: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: HALF,
    borderWidth: STROKE,
    borderColor: 'transparent',
  },
  cometHalo: {
    position: 'absolute',
    top: STROKE / 2 - COMET / 2,
    left: HALF - COMET / 2,
    width: COMET,
    height: COMET,
    borderRadius: COMET / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  cometCore: {
    position: 'absolute',
    top: STROKE / 2 - 4,
    left: HALF - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
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
    fontVariant: ['tabular-nums'],
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
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
