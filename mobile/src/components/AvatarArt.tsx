/**
 * AvatarArt — renders a collectible avatar (13-strong "Takımyıldızı" set) as a
 * self-contained circular SVG. No filters (react-native-svg lacks reliable blur)
 * — the premium glow comes from a radial halo behind the subject + gradient
 * fills + a rarity aura ring & orbiting particles. Static (perf-safe for lists).
 */
import React from 'react';
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop, ClipPath,
  Circle, Path, Line, Ellipse, G,
} from 'react-native-svg';
import {
  AVATAR_VISUAL, RARITY_COLOR, RARITY_PARTICLES, type AvatarId,
} from '../constants/avatars';

const NIGHT = '#0b0d20';

/**
 * Per-avatar subject shapes, drawn in a 200×200 field centred at (100,100).
 * Gradient ids are prefixed with the avatar id: react-native-svg resolves
 * `url(#…)` against a shared native registry, so a plain "g1" in a list of
 * avatars would make every card paint with the first card's gradient.
 */
function Subject({ id }: { id: AvatarId }) {
  const { c1, c2 } = AVATAR_VISUAL[id];
  switch (id) {
    case 'spark':
      return (
        <>
          <Path d="M100 44 L109 91 L156 100 L109 109 L100 156 L91 109 L44 100 L91 91 Z" fill={`url(#${id}-g1)`} />
          <Circle cx={100} cy={100} r={7} fill="#fff" />
          <Circle cx={68} cy={66} r={2.4} fill={c1} opacity={0.9} />
          <Circle cx={140} cy={78} r={1.8} fill="#fff" opacity={0.8} />
          <Circle cx={132} cy={140} r={2.2} fill={c2} opacity={0.9} />
        </>
      );
    case 'comet':
      return (
        <>
          <Path d="M52 150 Q92 116 122 78" stroke={`url(#${id}-g1)`} strokeWidth={13} strokeLinecap="round" fill="none" opacity={0.22} />
          <Path d="M66 138 Q98 110 122 80" stroke={`url(#${id}-g1)`} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.9} />
          <Circle cx={128} cy={74} r={15} fill={`url(#${id}-core)`} />
          <Circle cx={128} cy={74} r={7} fill="#fff" />
          <Circle cx={60} cy={80} r={1.8} fill={c1} opacity={0.9} />
          <Circle cx={150} cy={120} r={2} fill={c2} opacity={0.9} />
        </>
      );
    case 'crescent':
      return (
        <>
          <Path d="M118 50 A50 50 0 1 0 118 150 A40 40 0 1 1 118 50 Z" fill={`url(#${id}-g1)`} />
          <Path d="M138 78 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" fill="#fff" />
          <Circle cx={70} cy={64} r={2} fill={c1} opacity={0.9} />
          <Circle cx={84} cy={140} r={1.8} fill="#fff" opacity={0.85} />
        </>
      );
    case 'owl':
      return (
        <>
          <Path d="M66 72 L82 96 L64 94 Z" fill={`url(#${id}-g1)`} />
          <Path d="M134 72 L118 96 L136 94 Z" fill={`url(#${id}-g1)`} />
          <Path d="M100 68 C126 68 138 92 138 116 C138 145 121 158 100 158 C79 158 62 145 62 116 C62 92 74 68 100 68 Z" fill={`url(#${id}-g1)`} />
          <Circle cx={85} cy={108} r={15} fill={NIGHT} />
          <Circle cx={115} cy={108} r={15} fill={NIGHT} />
          <Circle cx={85} cy={108} r={8.5} fill="#FBBF24" />
          <Circle cx={115} cy={108} r={8.5} fill="#FBBF24" />
          <Circle cx={85} cy={108} r={3.6} fill={NIGHT} />
          <Circle cx={115} cy={108} r={3.6} fill={NIGHT} />
          <Path d="M100 118 L106 128 L94 128 Z" fill="#FBBF24" />
        </>
      );
    case 'fox':
      return (
        <>
          <Path d="M56 70 L84 96 L64 106 Z" fill={`url(#${id}-g1)`} />
          <Path d="M144 70 L116 96 L136 106 Z" fill={`url(#${id}-g1)`} />
          <Path d="M100 152 L58 96 C74 88 88 86 100 86 C112 86 126 88 142 96 Z" fill={`url(#${id}-g1)`} />
          <Path d="M100 152 L86 122 C92 120 108 120 114 122 Z" fill={NIGHT} opacity={0.5} />
          <Path d="M86 106 q6 5 0 10 M114 106 q-6 5 0 10" stroke={NIGHT} strokeWidth={4.5} fill="none" strokeLinecap="round" />
          <Circle cx={100} cy={140} r={4.5} fill={NIGHT} />
        </>
      );
    case 'deer':
      return (
        <>
          <Path d="M88 76 L80 42 M82 58 L68 50 M81 48 L72 34" stroke={`url(#${id}-g1)`} strokeWidth={3.4} strokeLinecap="round" fill="none" />
          <Path d="M112 76 L120 42 M118 58 L132 50 M119 48 L128 34" stroke={`url(#${id}-g1)`} strokeWidth={3.4} strokeLinecap="round" fill="none" />
          <Path d="M100 152 C85 152 79 122 83 98 C87 84 94 80 100 80 C106 80 113 84 117 98 C121 122 115 152 100 152 Z" fill={`url(#${id}-g1)`} />
          <Circle cx={90} cy={106} r={4.4} fill={NIGHT} />
          <Circle cx={110} cy={106} r={4.4} fill={NIGHT} />
          <Path d="M100 132 l0 8" stroke={NIGHT} strokeWidth={4} strokeLinecap="round" />
          <Circle cx={72} cy={34} r={2} fill="#fff" />
          <Circle cx={128} cy={34} r={2} fill="#fff" />
        </>
      );
    case 'nebula':
      return (
        <>
          <Path d="M100 54 a46 46 0 1 1 -0.1 0 M100 70 a30 30 0 1 0 0.1 0" fill="none" stroke={`url(#${id}-g1)`} strokeWidth={7} strokeLinecap="round" opacity={0.9} />
          <Path d="M100 80 L112 100 L100 120 L88 100 Z" fill="#fff" />
          <Path d="M100 88 L107 100 L100 112 L93 100 Z" fill={`url(#${id}-g1)`} />
          <Circle cx={152} cy={92} r={2.2} fill={c1} />
          <Circle cx={52} cy={116} r={2} fill={c2} />
        </>
      );
    case 'whale':
      return (
        <>
          <Path d="M108 58 Q113 46 107 40 M100 58 Q97 48 91 46" stroke={`url(#${id}-g1)`} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.85} />
          <Path d="M52 116 C64 90 116 84 142 100 C150 96 158 96 164 92 C160 104 160 110 166 118 C158 116 150 118 142 116 C120 134 72 138 52 116 Z" fill={`url(#${id}-g1)`} />
          <Path d="M60 118 C80 126 118 126 138 116" stroke={NIGHT} strokeWidth={2.5} fill="none" opacity={0.35} />
          <Circle cx={80} cy={112} r={4} fill={NIGHT} />
          <Circle cx={96} cy={44} r={1.8} fill="#fff" />
          <Circle cx={112} cy={40} r={1.5} fill="#fff" />
        </>
      );
    case 'cat':
      return (
        <>
          <Path d="M72 62 L88 90 L70 94 Z" fill={`url(#${id}-g1)`} />
          <Path d="M128 62 L112 90 L130 94 Z" fill={`url(#${id}-g1)`} />
          <Path d="M100 152 C79 152 68 128 72 106 C76 92 87 88 100 88 C113 88 124 92 128 106 C132 128 121 152 100 152 Z" fill={`url(#${id}-g1)`} />
          <Path d="M84 110 q7 -8 14 0" stroke={NIGHT} strokeWidth={4} fill="none" strokeLinecap="round" />
          <Path d="M102 110 q7 -8 14 0" stroke={NIGHT} strokeWidth={4} fill="none" strokeLinecap="round" />
          <Path d="M100 126 l0 7 M100 133 q-7 4 -14 1 M100 133 q7 4 14 1" stroke={NIGHT} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </>
      );
    case 'phoenix':
      return (
        <>
          <Path d="M100 108 C68 94 42 104 38 82 C64 92 84 82 100 96 Z" fill={`url(#${id}-g1)`} />
          <Path d="M100 108 C132 94 158 104 162 82 C136 92 116 82 100 96 Z" fill={`url(#${id}-g1)`} />
          <Path d="M100 152 C86 152 77 139 77 127 C77 116 84 108 100 104 C116 108 123 116 123 127 C123 139 114 152 100 152 Z" fill={`url(#${id}-g1)`} />
          <Path d="M100 104 C91 90 91 74 100 58 C109 74 109 90 100 104 Z" fill="#FFF3C4" />
          <Path d="M100 60 C104 52 110 50 116 50 C112 58 106 62 100 64 Z" fill={`url(#${id}-g1)`} />
          <Circle cx={100} cy={122} r={4} fill={NIGHT} />
        </>
      );
    case 'dragon':
      return (
        <>
          <Path d="M48 146 C72 128 58 100 86 96 C110 92 100 66 124 62 C140 59 146 72 156 70" stroke={`url(#${id}-g1)`} strokeWidth={9} fill="none" strokeLinecap="round" />
          <Path d="M156 70 L172 62 L165 80 Z" fill={`url(#${id}-g1)`} />
          <Path d="M124 62 l-3 -13 M100 78 l-4 -12 M82 96 l-6 -11" stroke={`url(#${id}-g1)`} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M132 56 q10 -10 22 -6" stroke={`url(#${id}-g1)`} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Circle cx={156} cy={68} r={2.6} fill={NIGHT} />
          <Circle cx={86} cy={96} r={2.2} fill="#fff" />
          <Circle cx={124} cy={62} r={2.2} fill="#fff" />
        </>
      );
    case 'nova':
      return (
        <>
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const r2 = i % 2 ? 72 : 52;
            return (
              <Line key={i}
                x1={100 + Math.cos(a) * 22} y1={100 + Math.sin(a) * 22}
                x2={100 + Math.cos(a) * r2} y2={100 + Math.sin(a) * r2}
                stroke={`url(#${id}-g1)`} strokeWidth={i % 2 ? 3 : 5} strokeLinecap="round" />
            );
          })}
          <Circle cx={100} cy={100} r={26} fill={`url(#${id}-core)`} />
          <Circle cx={100} cy={100} r={13} fill="#fff" />
        </>
      );
    case 'blackhole':
      return (
        <>
          <Ellipse cx={100} cy={100} rx={74} ry={26} fill="none" stroke={`url(#${id}-g1)`} strokeWidth={9} opacity={0.9} />
          <Ellipse cx={100} cy={100} rx={74} ry={26} fill="none" stroke="#fff" strokeWidth={2} opacity={0.5} />
          <Circle cx={100} cy={100} r={30} fill="#05060d" />
          <Circle cx={100} cy={100} r={30} fill="none" stroke={`url(#${id}-core)`} strokeWidth={3.5} />
        </>
      );
    default:
      return null;
  }
}

const STARS = [
  [40, 54], [150, 48], [62, 150], [156, 132], [30, 100],
  [172, 96], [96, 34], [120, 168], [46, 128], [168, 60],
];

interface Props {
  id: AvatarId;
  /** Diameter in px. */
  size?: number;
}

export function AvatarArt({ id, size = 40 }: Props) {
  const { c1, c2, rarity } = AVATAR_VISUAL[id];
  const aura = RARITY_COLOR[rarity];
  const particleCount = RARITY_PARTICLES[rarity];

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id={`${id}-g1`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c1} />
          <Stop offset="1" stopColor={c2} />
        </LinearGradient>
        <RadialGradient id={`${id}-neb`} cx="50%" cy="42%" r="62%">
          <Stop offset="0" stopColor="#20244d" />
          <Stop offset="0.55" stopColor="#0f1230" />
          <Stop offset="1" stopColor="#070914" />
        </RadialGradient>
        <RadialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fff" />
          <Stop offset="0.45" stopColor={c1} />
          <Stop offset="1" stopColor={c2} />
        </RadialGradient>
        <RadialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c1} stopOpacity={0.5} />
          <Stop offset="1" stopColor={c1} stopOpacity={0} />
        </RadialGradient>
        <ClipPath id={`${id}-disc`}><Circle cx={100} cy={100} r={100} /></ClipPath>
      </Defs>

      <G clipPath={`url(#${id}-disc)`}>
        <Circle cx={100} cy={100} r={100} fill={`url(#${id}-neb)`} />
        {STARS.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 0.9} fill="#cfe6ff" opacity={0.5} />
        ))}
        {/* soft glow behind subject */}
        <Circle cx={100} cy={100} r={78} fill={`url(#${id}-halo)`} />
        <Subject id={id} />
        {/* rarity orbiting particles */}
        {Array.from({ length: particleCount }).map((_, i) => {
          const a = (i / particleCount) * Math.PI * 2;
          return (
            <Circle key={`p${i}`}
              cx={100 + Math.cos(a) * 90} cy={100 + Math.sin(a) * 90}
              r={i % 2 ? 2.6 : 1.8} fill={aura} opacity={0.9} />
          );
        })}
      </G>
      {/* rarity rim */}
      <Circle cx={100} cy={100} r={98} fill="none" stroke={aura} strokeWidth={3} opacity={0.55} />
    </Svg>
  );
}
