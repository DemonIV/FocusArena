/**
 * WeeklySubjectDonutCard — "what did you study this week?" as a donut of
 * per-subject focus minutes, with a week navigator to look back at any past
 * week. Each subject keeps its own colour; identity lives in the legend text
 * (icon + name + time + %), never in colour alone.
 *
 * Data comes from the already-live monthly endpoint (getMonthly): a week can
 * straddle two calendar months, so we pull the month(s) it touches and sum the
 * seven relevant days' per-subject breakdown. No new backend surface.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { timerService } from '../services';

const CARD = '#131325';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#e2e8f0';
const MUTED = '#64748b';
const MUTED2 = '#94a3b8';
const ACCENT = '#00d2ff';
const TRACK = 'rgba(255,255,255,0.05)';
const NONE_COLOR = '#475569'; // "no subject" bucket

const SIZE = 190;
const STROKE = 26;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const GAP = 2.5; // surface gap between slices (px along the arc)

const DAY = 86_400_000;

interface Slice {
  key: string;
  name: string;
  icon: string | null;
  color: string;
  minutes: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar date (YYYY-MM-DD) — matches the backend's local-day grouping. */
function localKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local Monday 00:00 of the week `offset` weeks from the current one. */
function weekMonday(offset: number): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // local midnight
  const daysSinceMonday = (today.getDay() + 6) % 7; // 0=Sun → 6, 1=Mon → 0
  return new Date(today.getTime() - daysSinceMonday * DAY + offset * 7 * DAY);
}

/** The seven local YYYY-MM-DD keys of the week starting at `monday`. */
function weekDateKeys(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => localKey(new Date(monday.getTime() + i * DAY)));
}

export function WeeklySubjectDonutCard() {
  const { t } = useTranslation();
  // 0 = this week, -1 = last week, …
  const [offset, setOffset] = useState(0);

  const monday = useMemo(() => weekMonday(offset), [offset]);
  const dateKeys = useMemo(() => weekDateKeys(monday), [monday]);
  const monthA = dateKeys[0].slice(0, 7);
  const monthB = dateKeys[6].slice(0, 7);

  // One month usually covers the week; a boundary week needs the next one too.
  // Same key across the modal + both slots dedupes to a single request.
  const qA = useQuery({
    queryKey: ['monthly', 'me', monthA],
    queryFn: () => timerService.getMonthly(monthA),
    staleTime: 60_000,
  });
  const qB = useQuery({
    queryKey: ['monthly', 'me', monthB],
    queryFn: () => timerService.getMonthly(monthB),
    staleTime: 60_000,
    enabled: monthB !== monthA,
  });

  const months = [qA.data, monthB !== monthA ? qB.data : null].filter(Boolean) as NonNullable<typeof qA.data>[];
  const loading = qA.isLoading || (monthB !== monthA && qB.isLoading);

  const { slices, total } = useMemo(() => {
    const minutesByKey = new Map<string, number>();
    const meta = new Map<string, { name: string; icon: string | null; color: string }>();

    for (const m of months) {
      // Subject identity (name/icon/colour) — id null = the "no subject" bucket ('').
      for (const s of m.subjects) {
        const key = s.id ?? '';
        meta.set(key, {
          name: s.name ?? t('monthly.noSubject'),
          icon: s.icon,
          color: s.color ?? NONE_COLOR,
        });
      }
      // Sum only the seven days that belong to the selected week.
      const wanted = new Set(dateKeys);
      for (const day of m.days) {
        if (!wanted.has(day.date) || !day.subjects) continue;
        for (const [sid, mins] of Object.entries(day.subjects)) {
          minutesByKey.set(sid, (minutesByKey.get(sid) ?? 0) + mins);
        }
      }
    }

    const sum = [...minutesByKey.values()].reduce((a, b) => a + b, 0);
    const built: Slice[] = [...minutesByKey.entries()]
      .filter(([, mins]) => mins > 0)
      .map(([key, minutes]) => {
        const info = meta.get(key);
        return {
          key: key || 'none',
          name: info?.name ?? t('monthly.noSubject'),
          icon: info?.icon ?? null,
          color: info?.color ?? NONE_COLOR,
          minutes,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);

    return { slices: built, total: sum };
  }, [months, dateKeys, t]);

  const fmt = (m: number): string => {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    const hs = t('common.hourShort');
    const ms = t('common.minShort');
    if (h === 0) return `${rem}${ms}`;
    return rem > 0 ? `${h}${hs} ${rem}${ms}` : `${h}${hs}`;
  };

  // Relative week label — no month-name localisation needed.
  const weekLabel =
    offset === 0 ? t('home.thisWeekShort')
    : offset === -1 ? t('home.lastWeekShort')
    : t('home.weeksAgo', { count: -offset });
  const rangeLabel = `${dateKeys[0].slice(8)}.${dateKeys[0].slice(5, 7)} – ${dateKeys[6].slice(8)}.${dateKeys[6].slice(5, 7)}`;

  // Donut slice geometry (dash segments on one circle).
  let cursor = 0;
  const arcs = slices.map((s) => {
    const len = (s.minutes / total) * CIRC;
    const arc = { s, start: cursor, length: Math.max(1, len - GAP) };
    cursor += len;
    return arc;
  });

  return (
    <View style={styles.card}>
      {/* Week navigator */}
      <View style={styles.nav}>
        <Pressable
          hitSlop={10}
          onPress={() => setOffset((o) => o - 1)}
          style={styles.navBtn}
        >
          <Text style={styles.navChevron}>‹</Text>
        </Pressable>

        <View style={styles.navCenter}>
          <Text style={styles.navLabel}>{weekLabel}</Text>
          <Text style={styles.navRange}>{rangeLabel}</Text>
        </View>

        <Pressable
          hitSlop={10}
          onPress={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          style={[styles.navBtn, offset >= 0 && styles.navBtnDisabled]}
        >
          <Text style={styles.navChevron}>›</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginVertical: 48 }} />
      ) : total === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗓️</Text>
          <Text style={styles.emptyText}>{t('home.noStudyWeek')}</Text>
        </View>
      ) : (
        <>
          {/* Donut */}
          <View style={styles.donutWrap}>
            <Svg width={SIZE} height={SIZE}>
              <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
                <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={TRACK} strokeWidth={STROKE} fill="none" />
                {arcs.map(({ s, start, length }) => (
                  <Circle
                    key={s.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={R}
                    stroke={s.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${length} ${CIRC - length}`}
                    strokeDashoffset={-start}
                    strokeLinecap="butt"
                    fill="none"
                  />
                ))}
              </G>
            </Svg>
            <View style={styles.center} pointerEvents="none">
              <Text style={styles.centerValue}>{fmt(total)}</Text>
              <Text style={styles.centerLabel}>{t('monthly.totalLabel')}</Text>
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {slices.map((s) => {
              const pct = Math.round((s.minutes / total) * 100);
              return (
                <View key={s.key} style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text style={styles.legendName} numberOfLines={1}>
                    {s.icon ? `${s.icon} ` : ''}{s.name}
                  </Text>
                  <Text style={styles.legendTime}>{fmt(s.minutes)}</Text>
                  <Text style={styles.legendPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: BORDER,
  },

  // Week navigator
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  navBtnDisabled: { opacity: 0.3 },
  navChevron: { color: TEXT, fontSize: 22, fontWeight: '400', lineHeight: 24 },
  navCenter: { flex: 1, alignItems: 'center' },
  navLabel: { color: TEXT, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  navRange: { color: MUTED, fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Donut
  donutWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  center: { position: 'absolute', alignItems: 'center' },
  centerValue: { color: TEXT, fontSize: 22, fontWeight: '800' },
  centerLabel: { color: MUTED, fontSize: 11, marginTop: 2 },

  // Legend
  legend: { gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendName: { color: TEXT, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  legendTime: { color: ACCENT, fontSize: 13, fontWeight: '700', marginRight: 10 },
  legendPct: { color: MUTED, fontSize: 12, fontWeight: '600', width: 38, textAlign: 'right' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { fontSize: 34, marginBottom: 10 },
  emptyText: { color: MUTED2, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
