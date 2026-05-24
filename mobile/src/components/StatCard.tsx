import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  style?: ViewStyle;
}

export function StatCard({ label, value, sub, accent = '#00d2ff', style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 90,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 11,
    color: '#8a8a9a',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sub: {
    fontSize: 10,
    color: '#8a8a9a',
    marginTop: 2,
  },
});
