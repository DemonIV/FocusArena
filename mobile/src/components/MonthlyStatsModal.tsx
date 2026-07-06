/**
 * MonthlyStatsModal — calendar-month, day-by-day focus stats with a
 * per-subject breakdown. Shows the caller's own stats or a friend's
 * (the backend enforces the friendship).
 *
 * Layout: month navigator → calendar grid (tap a day for its subject
 * breakdown) → month summary → subject totals with share bars.
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { timerService } from '../services';
import { formatDuration } from '../utils/formatTime';
import type { MonthlyStats, MonthlyDay } from '../types';

const BG = '#0a0a1a';
const CARD = '#131325';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#e2e8f0';
const MUTED = '#64748b';
const ACCENT = '#00d2ff';
const EMPTY = 'rgba(255,255,255,0.05)';

// Same intensity buckets as StreakHeatmap so the two views read alike
const LEVELS = [EMPTY, `${ACCENT}33`, `${ACCENT}66`, `${ACCENT}AA`, ACCENT];

function levelFor(min: number): number {
  if (min <= 0) return 0;
  if (min < 30) return 1;
  if (min < 60) return 2;
  if (min < 120) return 3;
  return 4;
}

/** Monday-indexed weekday (Mon=0 … Sun=6) for a YYYY-MM-DD string (UTC). */
function mondayDow(dateStr: string): number {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return (dow + 6) % 7;
}

/** Current UTC month as YYYY-MM. */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Shift a YYYY-MM month by n months. */
function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const MAX_MONTHS_BACK = 24;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Whose stats — omit for the signed-in user */
  userId?: string;
  /** Shown in the header while the first load is in flight */
  username?: string;
}

export function MonthlyStatsModal({ visible, onClose, userId, username }: Props) {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const statsQ = useQuery({
    queryKey: ['monthly', userId ?? 'me', month],
    queryFn: () => timerService.getMonthly(month, userId),
    enabled: visible,
    staleTime: 60_000,
  });
  const data: MonthlyStats | undefined = statsQ.data;

  const monthTitle = useMemo(() => {
    try {
      return new Date(`${month}-01T00:00:00Z`).toLocaleDateString(i18n.language, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return month;
    }
  }, [month, i18n.language]);

  const weekdayLabels = (t('home.weekdaysShort') as string).split(',');

  // Calendar rows: pad the first week so column 0 is always Monday.
  const weeks = useMemo(() => {
    const days = data?.days ?? [];
    if (days.length === 0) return [] as (MonthlyDay | null)[][];
    const cells: (MonthlyDay | null)[] = [];
    for (let i = 0; i < mondayDow(days[0].date); i++) cells.push(null);
    cells.push(...days);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (MonthlyDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [data?.days]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const selectedDay = data?.days.find((d) => d.date === selectedDate) ?? null;
  const subjectById = useMemo(
    () => new Map((data?.subjects ?? []).map((s) => [s.id ?? '', s])),
    [data?.subjects],
  );
  const maxSubjectMinutes = data?.subjects[0]?.totalMinutes ?? 0;

  const changeMonth = useCallback((n: number) => {
    setSelectedDate(null);
    setMonth((m) => shiftMonth(m, n));
  }, []);

  const atCurrentMonth = month >= currentMonth();
  const atOldestMonth = month <= shiftMonth(currentMonth(), -MAX_MONTHS_BACK);

  const subjectLabel = (id: string) => {
    const s = subjectById.get(id);
    return s?.name ? `${s.icon ?? ''} ${s.name}`.trim() : t('monthly.noSubject');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            📅 {data?.user.username ?? username ?? t('monthly.title')}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Month navigator */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => changeMonth(-1)}
              disabled={atOldestMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.navArrow, atOldestMonth && styles.navArrowDisabled]}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              disabled={atCurrentMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.navArrow, atCurrentMonth && styles.navArrowDisabled]}>›</Text>
            </TouchableOpacity>
          </View>

          {statsQ.isLoading && <ActivityIndicator color={ACCENT} style={{ marginVertical: 40 }} />}
          {statsQ.isError && (
            <Text style={styles.errorText}>{t('monthly.loadFailed')}</Text>
          )}

          {data && (
            <>
              {/* Calendar */}
              <View style={styles.card}>
                <View style={styles.weekdayRow}>
                  {weekdayLabels.map((w, i) => (
                    <Text key={i} style={styles.weekdayLabel}>{w}</Text>
                  ))}
                </View>
                {weeks.map((week, wi) => (
                  <View key={wi} style={styles.weekRow}>
                    {week.map((day, di) =>
                      day ? (
                        <TouchableOpacity
                          key={di}
                          style={[
                            styles.dayCell,
                            { backgroundColor: LEVELS[levelFor(day.totalMinutes)] },
                            day.date === todayStr && styles.dayCellToday,
                            day.date === selectedDate && styles.dayCellSelected,
                          ]}
                          onPress={() => setSelectedDate(day.date === selectedDate ? null : day.date)}
                        >
                          <Text
                            style={[
                              styles.dayNum,
                              levelFor(day.totalMinutes) >= 3 && styles.dayNumOnAccent,
                            ]}
                          >
                            {Number(day.date.slice(8, 10))}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View key={di} style={[styles.dayCell, styles.dayCellEmpty]} />
                      ),
                    )}
                  </View>
                ))}

                {/* Tapped-day breakdown */}
                {selectedDay && (
                  <View style={styles.dayDetail}>
                    <Text style={styles.dayDetailTitle}>
                      {Number(selectedDay.date.slice(8, 10))} {monthTitle} ·{' '}
                      <Text style={{ color: ACCENT }}>{formatDuration(selectedDay.totalMinutes)}</Text>
                    </Text>
                    {selectedDay.totalMinutes === 0 ? (
                      <Text style={styles.dayDetailEmpty}>{t('monthly.noActivityDay')}</Text>
                    ) : (
                      Object.entries(selectedDay.subjects ?? {})
                        .sort((a, b) => b[1] - a[1])
                        .map(([sid, min]) => (
                          <View key={sid} style={styles.dayDetailRow}>
                            <View
                              style={[
                                styles.subjectDot,
                                { backgroundColor: subjectById.get(sid)?.color ?? MUTED },
                              ]}
                            />
                            <Text style={styles.dayDetailSubject} numberOfLines={1}>
                              {subjectLabel(sid)}
                            </Text>
                            <Text style={styles.dayDetailMin}>{formatDuration(min)}</Text>
                          </View>
                        ))
                    )}
                  </View>
                )}
              </View>

              {/* Month summary */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryValue}>{formatDuration(data.summary.totalMinutes)}</Text>
                  <Text style={styles.summaryLabel}>{t('monthly.totalLabel')}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryValue}>{data.summary.activeDays}</Text>
                  <Text style={styles.summaryLabel}>{t('monthly.activeDaysLabel')}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryValue}>{formatDuration(data.summary.bestDayMinutes)}</Text>
                  <Text style={styles.summaryLabel}>{t('monthly.bestDayLabel')}</Text>
                </View>
              </View>

              {/* Subject totals */}
              <Text style={styles.sectionTitle}>{t('monthly.subjectsTitle')}</Text>
              {data.subjects.length === 0 ? (
                <Text style={styles.emptyText}>{t('monthly.noActivityMonth')}</Text>
              ) : (
                data.subjects.map((s) => (
                  <View key={s.id ?? 'none'} style={styles.subjectRow}>
                    <View style={[styles.subjectDot, { backgroundColor: s.color ?? MUTED }]} />
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectName} numberOfLines={1}>
                        {s.name ? `${s.icon ?? ''} ${s.name}`.trim() : t('monthly.noSubject')}
                      </Text>
                      <View style={styles.subjectBarTrack}>
                        <View
                          style={[
                            styles.subjectBarFill,
                            {
                              backgroundColor: s.color ?? ACCENT,
                              width: `${Math.max(4, Math.round((s.totalMinutes / Math.max(1, maxSubjectMinutes)) * 100))}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={styles.subjectMin}>{formatDuration(s.totalMinutes)}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { color: TEXT, fontSize: 20, fontWeight: '800', flex: 1, marginRight: 12 },
  closeIcon: { color: MUTED, fontSize: 22, fontWeight: '600' },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  navArrow: { color: ACCENT, fontSize: 30, fontWeight: '700', paddingHorizontal: 14 },
  navArrowDisabled: { color: 'rgba(255,255,255,0.15)' },
  monthTitle: { color: TEXT, fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },

  errorText: { color: '#ef4444', textAlign: 'center', marginVertical: 32 },
  emptyText: { color: MUTED, textAlign: 'center', marginVertical: 16 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekdayLabel: { flex: 1, textAlign: 'center', color: MUTED, fontSize: 11, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellEmpty: { backgroundColor: 'transparent' },
  dayCellToday: { borderWidth: 1.5, borderColor: '#f5a623' },
  dayCellSelected: { borderWidth: 1.5, borderColor: TEXT },
  dayNum: { color: TEXT, fontSize: 12, fontWeight: '600' },
  dayNumOnAccent: { color: '#04121a', fontWeight: '800' },

  dayDetail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  dayDetailTitle: { color: TEXT, fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'capitalize' },
  dayDetailEmpty: { color: MUTED, fontSize: 13 },
  dayDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dayDetailSubject: { color: TEXT, fontSize: 13, flex: 1 },
  dayDetailMin: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryBox: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    alignItems: 'center',
  },
  summaryValue: { color: ACCENT, fontSize: 17, fontWeight: '800' },
  summaryLabel: { color: MUTED, fontSize: 11, marginTop: 4, textAlign: 'center' },

  sectionTitle: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 8,
  },
  subjectDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  subjectInfo: { flex: 1, marginRight: 10 },
  subjectName: { color: TEXT, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  subjectBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  subjectBarFill: { height: '100%', borderRadius: 3 },
  subjectMin: { color: TEXT, fontSize: 13, fontWeight: '700' },
});
