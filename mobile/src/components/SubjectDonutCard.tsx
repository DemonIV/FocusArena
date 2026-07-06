/**
 * SubjectDonutCard — donut chart of all-time focus minutes per subject,
 * in each subject's own color, with a legend that carries identity in
 * text (icon + name + time), never in color alone.
 *
 * Geometry: stroke-dasharray segments on a single circle, 2px surface
 * gaps between slices, total focus time as the hero number in the hole.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { SubjectStat } from '../types';

const CARD = '#131325';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#e2e8f0';
const MUTED = '#64748b';
const ACCENT = '#00d2ff';
const TRACK = 'rgba(255,255,255,0.05)';

const SIZE = 190;
const STROKE = 26;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
/** Surface gap between adjacent slices (px along the arc) */
const GAP = 2.5;

interface Props {
  subjects: SubjectStat[];
}

export function SubjectDonutCard({ subjects }: Props) {
  const { t } = useTranslation();

  const { slices, total } = useMemo(() => {
    const withTime = subjects
      .filter((s) => s.totalMinutes > 0)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
    const sum = withTime.reduce((acc, s) => acc + s.totalMinutes, 0);

    let cursor = 0;
    const segs = withTime.map((s) => {
      const len = (s.totalMinutes / sum) * CIRC;
      const seg = { subject: s, start: cursor, length: Math.max(1, len - GAP) };
      cursor += len;
      return seg;
    });
    return { slices: segs, total: sum };
  }, [subjects]);

  if (total === 0) return null;

  const fmt = (m: number): string => {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    const hs = t('common.hourShort');
    const ms = t('common.minShort');
    if (h === 0) return `${rem}${ms}`;
    return rem > 0 ? `${h}${hs} ${rem}${ms}` : `${h}${hs}`;
  };

  return (
    <View style={styles.card}>
      {/* Donut */}
      <View style={styles.donutWrap}>
        <Svg width={SIZE} height={SIZE}>
          <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
            {/* Recessive full-circle track behind the slices */}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={TRACK}
              strokeWidth={STROKE}
              fill="none"
            />
            {slices.map(({ subject, start, length }) => (
              <Circle
                key={subject.id}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={subject.color}
                strokeWidth={STROKE}
                strokeDasharray={`${length} ${CIRC - length}`}
                strokeDashoffset={-start}
                strokeLinecap="butt"
                fill="none"
              />
            ))}
          </G>
        </Svg>
        {/* Hero number in the hole */}
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.centerValue}>{fmt(total)}</Text>
          <Text style={styles.centerLabel}>{t('monthly.totalLabel')}</Text>
        </View>
      </View>

      {/* Legend — identity lives here, not in color alone */}
      <View style={styles.legend}>
        {slices.map(({ subject }) => {
          const pct = Math.round((subject.totalMinutes / total) * 100);
          return (
            <View key={subject.id} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: subject.color }]} />
              <Text style={styles.legendName} numberOfLines={1}>
                {subject.icon} {subject.name}
              </Text>
              <Text style={styles.legendTime}>{fmt(subject.totalMinutes)}</Text>
              <Text style={styles.legendPct}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  centerValue: { color: TEXT, fontSize: 22, fontWeight: '800' },
  centerLabel: { color: MUTED, fontSize: 11, marginTop: 2 },

  legend: { gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendName: { color: TEXT, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  legendTime: { color: ACCENT, fontSize: 13, fontWeight: '700', marginRight: 10 },
  legendPct: { color: MUTED, fontSize: 12, fontWeight: '600', width: 38, textAlign: 'right' },
});
