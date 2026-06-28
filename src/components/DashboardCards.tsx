/**
 * Shared dashboard rail cards — leaderboard standing + recent community
 * posts. Originally private to home.tsx; extracted so profile/community/
 * leaderboard can reuse the same rail content on desktop.
 */

import { Text, View } from 'react-native';

import { Avatar, Body, Button, Eyebrow, GlassCard, PressableScale, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/theme/use-theme';
import type { Post } from '@/types';

export function LeaderboardCard({ rank, onOpen }: { rank: { rank: number; totalPoints: number } | null; onOpen: () => void }) {
  const palette = usePalette();
  return (
    <GlassCard style={{ gap: Spacing.three }}>
      <Eyebrow>Leaderboard</Eyebrow>
      {rank && rank.rank > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two }}>
          <Text style={{ fontFamily: Type.displayBold, fontSize: 30, color: palette.accent }}>#{rank.rank}</Text>
          <Small color={palette.textSecondary}>{rank.totalPoints} pts globally</Small>
        </View>
      ) : rank ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two }}>
          <Text style={{ fontFamily: Type.displayBold, fontSize: 30, color: palette.text }}>{rank.totalPoints}</Text>
          <Small color={palette.textSecondary}>pts · go public to rank</Small>
        </View>
      ) : (
        <Body color={palette.textSecondary}>Cook meals to start climbing the board.</Body>
      )}
      <Button title="View leaderboard" variant="secondary" onPress={onOpen} />
    </GlassCard>
  );
}

export function CommunityCard({ posts, onOpenPost, onOpenAll }: { posts: Post[]; onOpenPost: (id: string) => void; onOpenAll: () => void }) {
  const palette = usePalette();
  return (
    <GlassCard style={{ gap: Spacing.three }}>
      <Eyebrow>Community</Eyebrow>
      {posts.length === 0 ? (
        <Body color={palette.textSecondary}>Be the first to share what you cooked this week.</Body>
      ) : (
        <View style={{ gap: Spacing.two }}>
          {posts.map((p) => (
            <PressableScale key={p.id} onPress={() => onOpenPost(p.id)} to={0.98}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <Avatar name={p.author.displayName || p.author.username} uri={p.author.avatarUrl} size={24} />
                <Small color={palette.text} numberOfLines={1} style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Type.bodySemibold }}>{p.author.displayName || p.author.username}</Text>
                  {p.recipeTitle ? ` · ${p.recipeTitle}` : p.body ? ` · ${p.body}` : ''}
                </Small>
              </View>
            </PressableScale>
          ))}
        </View>
      )}
      <Button title="Open community" variant="secondary" onPress={onOpenAll} />
    </GlassCard>
  );
}
