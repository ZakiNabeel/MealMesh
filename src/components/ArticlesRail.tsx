/**
 * ArticlesRail — compact "From the kitchen" card list for the desktop side
 * rail on profile/community/leaderboard. Renders nothing when the blog has
 * no live feed (e.g. EXPO_PUBLIC_BLOG_URL unset) rather than showing
 * marketing-site placeholder content inside the app.
 */

import { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { Eyebrow, GlassCard, PressableScale, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { getLatestArticles, type FeedArticle } from '@/lib/articles';
import { usePalette } from '@/theme/use-theme';

export function ArticlesRail({ limit = 3 }: { limit?: number }) {
  const palette = usePalette();
  const [articles, setArticles] = useState<FeedArticle[]>([]);

  useEffect(() => {
    void getLatestArticles(limit).then(setArticles);
  }, [limit]);

  if (articles.length === 0) return null;

  return (
    <GlassCard style={{ gap: Spacing.three }}>
      <Eyebrow>From the kitchen</Eyebrow>
      <View style={{ gap: Spacing.three }}>
        {articles.map((a) => (
          <PressableScale key={a.slug} onPress={() => Linking.openURL(a.url)} to={0.98}>
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Image source={{ uri: a.heroImage }} alt={a.heroImageAlt} resizeMode="cover" style={styles.thumb} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: Type.bodySemibold, fontSize: 10.5, color: palette.accent, letterSpacing: 0.4 }}>
                  {a.category.toUpperCase()}
                </Text>
                <Text numberOfLines={2} style={{ fontFamily: Type.bodySemibold, fontSize: 14, color: palette.text }}>
                  {a.title}
                </Text>
                <Small color={palette.textSecondary} numberOfLines={2}>{a.excerpt}</Small>
              </View>
            </View>
          </PressableScale>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: Radius.md },
});
