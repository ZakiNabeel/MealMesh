/**
 * FoodMarquee — the desktop right-rail. Two columns of dish photos drift
 * vertically in opposite directions, an endless, calm "everything we can plan"
 * showcase. Real photos when Pexels is configured (`EXPO_PUBLIC_PEXELS_KEY`),
 * emoji-gradient tiles otherwise. Web-only; renders nothing on native.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { FoodImage } from '@/components/FoodImage';
import { Radius, Spacing } from '@/constants/theme';
import { FALLBACK_DISHES, loadFoodPhotos } from '@/lib/photos';
import { usePalette, useReduced } from '@/theme/use-theme';

const TILE_H = 200;
const GAP = Spacing.three;
const PX_PER_SEC = 22; // unhurried drift

type Tile = { key: string; uri?: string; name: string; ingredients: string[] };

function PhotoTile({ tile, palette }: { tile: Tile; palette: ReturnType<typeof usePalette> }) {
  const frame = { height: TILE_H, borderRadius: Radius.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' as const };
  if (tile.uri) {
    return <Image source={{ uri: tile.uri }} resizeMode="cover" style={[styles.tile, frame]} />;
  }
  return <FoodImage name={tile.name} ingredients={tile.ingredients} style={[styles.tile, frame]} radius={Radius.lg} emojiSize={44} />;
}

function Column({ tiles, direction }: { tiles: Tile[]; direction: 'up' | 'down' }) {
  const palette = usePalette();
  const reduce = useReduced();
  const setHeight = tiles.length * (TILE_H + GAP);
  const y = useSharedValue(direction === 'up' ? 0 : -setHeight);

  useEffect(() => {
    if (reduce || setHeight === 0) return;
    const duration = (setHeight / PX_PER_SEC) * 1000;
    const from = direction === 'up' ? 0 : -setHeight;
    const to = direction === 'up' ? -setHeight : 0;
    y.value = from;
    y.value = withRepeat(withTiming(to, { duration, easing: Easing.linear }), -1, false);
  }, [direction, setHeight, reduce, y]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  // Duplicate the set so the loop is seamless.
  const doubled = [...tiles, ...tiles];

  return (
    <View style={styles.colClip}>
      <Animated.View style={[styles.colInner, animated]}>
        {doubled.map((t, i) => (
          <PhotoTile key={`${t.key}-${i}`} tile={t} palette={palette} />
        ))}
      </Animated.View>
    </View>
  );
}

export function FoodMarquee() {
  const palette = usePalette();
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    loadFoodPhotos().then((urls) => {
      if (alive) setPhotos(urls);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [colA, colB] = useMemo<[Tile[], Tile[]]>(() => {
    const tiles: Tile[] =
      photos.length > 0
        ? photos.map((uri, i) => ({ key: `p${i}`, uri, name: 'dish', ingredients: [] }))
        : FALLBACK_DISHES.map((d, i) => ({ key: `f${i}`, name: d.name, ingredients: d.ingredients }));
    const a: Tile[] = [];
    const b: Tile[] = [];
    tiles.forEach((t, i) => (i % 2 === 0 ? a : b).push(t));
    // Ensure both columns have enough tiles to fill a tall screen.
    while (a.length < 4) a.push(...a);
    while (b.length < 4) b.push(...b);
    return [a, b];
  }, [photos]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.rail} pointerEvents="none">
      <View style={styles.columns}>
        <Column tiles={colA} direction="up" />
        <Column tiles={colB} direction="down" />
      </View>
      {/* soft fades top & bottom so tiles dissolve into the page */}
      <LinearGradient
        colors={[palette.background, palette.background + '00']}
        style={[styles.fade, { top: 0 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[palette.background + '00', palette.background]}
        style={[styles.fade, { bottom: 0 }]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flex: 1, overflow: 'hidden' },
  columns: { flex: 1, flexDirection: 'row', gap: GAP, paddingHorizontal: GAP },
  colClip: { flex: 1, overflow: 'hidden' },
  colInner: { gap: GAP },
  tile: { width: '100%' },
  fade: { position: 'absolute', left: 0, right: 0, height: 96 },
});
