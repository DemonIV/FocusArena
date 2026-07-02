/**
 * FramedAvatar — avatar (image or letter fallback) wrapped in the user's
 * equipped cosmetic frame ring. Used on leaderboard, friends and rooms so
 * purchased frames are visible to everyone (the whole point of buying one).
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getFrameVisual } from '../constants/frames';

const ACCENT = '#00d2ff';

interface Props {
  username: string;
  avatarUrl?: string | null;
  frameId?: string | null;
  /** Avatar diameter (excluding frame ring), default 40 */
  size?: number;
}

export function FramedAvatar({ username, avatarUrl, frameId, size = 40 }: Props) {
  const frame = getFrameVisual(frameId);
  const radius = size / 2;

  const avatar = avatarUrl ? (
    <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: radius }} />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.letter, { fontSize: size * 0.4 }]}>
        {username.charAt(0).toUpperCase()}
      </Text>
    </View>
  );

  if (!frame) return avatar;

  // Frame ring: colored border + glow, plus a thin second ring for dual-ring frames.
  const ringSize = size + 8;
  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      {frame.outer2 && (
        <View
          style={[
            styles.ring,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: 1.5,
              borderColor: `${frame.outer2}88`,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.ring,
          {
            width: size + 5,
            height: size + 5,
            borderRadius: (size + 5) / 2,
            borderWidth: 2,
            borderColor: frame.ring,
            shadowColor: frame.glow,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 6,
            elevation: 5,
          },
        ]}
      />
      {avatar}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: `${ACCENT}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: ACCENT, fontWeight: '700' },
  ring: { position: 'absolute' },
});
