/**
 * Photo helpers for the admin app.
 *
 * Workers and firms carry a profile picture and a work gallery that customers
 * see before booking. An admin reviewing an account needs the same view — a
 * row of initials tells you nothing about whether somebody uploaded a usable
 * photo or a blurry screenshot.
 *
 * Both components fall back cleanly: no URL means the caller's own placeholder
 * is rendered, and a gallery with nothing in it renders nothing at all.
 */

import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

interface PhotoCircleProps {
  uri?: string | null;
  size: number;
  /** Rounding. Defaults to a circle; pass a number for the squircle tiles. */
  radius?: number;
  /** Shown when there is no photo — the existing initial/icon placeholder. */
  fallback: ReactNode;
  style?: ViewStyle;
}

export function PhotoCircle({ uri, size, radius, fallback, style }: PhotoCircleProps) {
  if (!uri) return <>{fallback}</>;
  return (
    <View style={style}>
      <Image
        source={{ uri }}
        contentFit="cover"
        transition={160}
        style={{ width: size, height: size, borderRadius: radius ?? size / 2 }}
      />
    </View>
  );
}

interface PhotoRowProps {
  uris?: string[] | null;
  height?: number;
  width?: number;
  backgroundColor: string;
}

export function PhotoRow({ uris, height = 110, width = 150, backgroundColor }: PhotoRowProps) {
  if (!uris || uris.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {uris.map((uri, i) => (
        <Image
          key={`${uri}-${i}`}
          source={{ uri }}
          contentFit="cover"
          transition={160}
          style={[styles.image, { width, height, backgroundColor }]}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  image: { borderRadius: 10 },
});
