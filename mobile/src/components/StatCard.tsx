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
    backgroundColor: '#131325',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 90,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    textAlign: 'center',
  },
  sub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
});
