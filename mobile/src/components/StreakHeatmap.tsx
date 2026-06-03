/**
 * StreakHeatmap — GitHub-contribution-style activity calendar.
 *
 * Renders the last N days of focus minutes as a grid of week columns
 * (Mon → Sun, top → bottom). No SVG: each cell is a plain View whose
 * colour intensity scales with minutes studied that day.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HeatmapDay } from '../types';

const ACCENT = '#00d2ff';
const EMPTY  = 'rgba(255,255,255,0.05)';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';

// Five intensity buckets (minutes → colour)
const LEVELS = [EMPTY, `${ACCENT}33`, `${ACCENT}66`, `${ACCENT}AA`, ACCENT];

function levelFor(min: number): number {
  if (min <= 0)  return 0;
  if (min < 30)  return 1;
  if (min < 60)  return 2;
  if (min < 120) return 3;
  return 4;
}

/** Monday-indexed weekday (Mon=0 … Sun=6) for a YYYY-MM-DD string (UTC). */
function mondayDow(dateStr: string): number {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  return (dow + 6) % 7;
}

interface Props {
  days: HeatmapDay[];
  currentStreak: number;
  longestStreak: number;
}

export function StreakHeatmap({ days, currentStreak, longestStreak }: Props) {
  const { t } = useTranslation();

  // Build week columns: pad the first week so row 0 is always Monday.
  const weeks = useMemo(() => {
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) return [] as (HeatmapDay | null)[][];

    const cells: (HeatmapDay | null)[] = [];
    const lead = mondayDow(sorted[0].date);
    for (let i = 0; i < lead; i++) cells.push(null);
    cells.push(...sorted);
    while (cells.length % 7 !== 0) cells.push(null);

    const cols: (HeatmapDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
    return cols;
  }, [days]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🔥 {t('profile.streakCalendar')}</Text>
        <Text style={styles.streakNow}>{t('profile.dayStreak', { count: currentStreak })}</Text>
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekCol}>
            {week.map((cell, di) => (
              <View
                key={di}
                style={[
                  styles.cell,
                  { backgroundColor: cell ? LEVELS[levelFor(cell.totalMinutes)] : 'transparent' },
                ]}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Footer: longest streak + legend */}
      <View style={styles.footer}>
        <Text style={styles.longest}>{t('profile.longestStreak', { count: longestStreak })}</Text>
        <View style={styles.legend}>
          <Text style={styles.legendLabel}>{t('profile.heatLess')}</Text>
          {LEVELS.map((c, i) => (
            <View key={i} style={[styles.legendCell, { backgroundColor: c === EMPTY ? EMPTY : c }]} />
          ))}
          <Text style={styles.legendLabel}>{t('profile.heatMore')}</Text>
        </View>
      </View>
    </View>
  );
}

const CELL = 14;
const GAP = 4;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#131325',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { color: TEXT, fontSize: 15, fontWeight: '700' },
  streakNow: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  grid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: GAP,
  },
  weekCol: { gap: GAP },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  longest: { color: MUTED, fontSize: 12, fontWeight: '600' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendLabel: { color: MUTED, fontSize: 10, marginHorizontal: 2 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
});
