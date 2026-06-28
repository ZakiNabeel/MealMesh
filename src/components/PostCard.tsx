/**
 * Reddit-style post card — a vertical vote rail on the left, content on the
 * right. Shared by the community feed (src/app/community.tsx) and a
 * profile's "Posts" tab (src/app/profile.tsx, src/app/u/[username].tsx).
 */

import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Avatar, Body, GlassCard, PressableScale, ProBadge, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { vote } from '@/lib/community';
import { usePalette } from '@/theme/use-theme';
import type { Post } from '@/types';

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const palette = usePalette();
  const [score, setScore] = useState(post.score);
  const [myVote, setMyVote] = useState(post.myVote);

  const cast = (value: 1 | -1) => {
    const next = myVote === value ? 0 : value;
    setScore(score - myVote + next);
    setMyVote(next);
    void vote('post', post.id, value);
  };

  return (
    <GlassCard style={{ flexDirection: 'row', gap: Spacing.two }}>
      <View style={[styles.voteRail, { backgroundColor: palette.backgroundElement }]}>
        <PressableScale onPress={() => cast(1)} to={0.85}>
          <Text style={{ fontSize: 17, lineHeight: 20, color: myVote === 1 ? palette.accent : palette.textSecondary }}>▲</Text>
        </PressableScale>
        <Text style={{ fontFamily: Type.bodyBold, fontSize: 13, color: palette.text }}>{score}</Text>
        <PressableScale onPress={() => cast(-1)} to={0.85}>
          <Text style={{ fontSize: 17, lineHeight: 20, color: myVote === -1 ? palette.blue : palette.textSecondary }}>▼</Text>
        </PressableScale>
      </View>

      <PressableScale onPress={onOpen} to={0.99} style={{ flex: 1 }}>
        <View style={{ gap: Spacing.two, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Avatar name={post.author.displayName || post.author.username} uri={post.author.avatarUrl} size={24} />
            <Body numberOfLines={1} style={{ fontFamily: Type.bodySemibold, flexShrink: 1 }}>
              {post.author.displayName || post.author.username}
            </Body>
            {post.author.isPro && <ProBadge size={13} />}
            <Small color={palette.textSecondary}>· {timeAgo(post.createdAt)}</Small>
          </View>

          {post.type === 'recipe' && post.recipeTitle && (
            <View style={[styles.recipeChip, { borderColor: palette.border, backgroundColor: palette.backgroundElement }]}>
              <Small color={palette.text} style={{ fontFamily: Type.bodySemibold }}>📖 {post.recipeTitle}</Small>
            </View>
          )}

          {post.body && (
            <Body numberOfLines={4} style={{ fontFamily: Type.body }}>
              {post.body}
            </Body>
          )}

          {post.imageUrl && <Image source={{ uri: post.imageUrl }} resizeMode="cover" style={styles.postImage} />}

          <Small color={palette.textSecondary}>
            {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
          </Small>
        </View>
      </PressableScale>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  voteRail: { width: 34, borderRadius: 12, paddingVertical: Spacing.two, alignItems: 'center', justifyContent: 'center', gap: 4 },
  recipeChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  postImage: { width: '100%', height: 180, borderRadius: 14 },
});
