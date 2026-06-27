/**
 * Reddit-style community feed — Hot / New / Top / Following. Posting and
 * commenting require a public profile (so the author's name/avatar can
 * actually resolve for other viewers); reading and voting never do.
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Art } from '@/components/art';
import { Avatar, Body, Button, Chip, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getFeed, vote } from '@/lib/community';
import { getMyProfile } from '@/lib/social';
import { usePalette } from '@/theme/use-theme';
import type { FeedSort, Post } from '@/types';

const SORTS: { key: FeedSort; label: string }[] = [
  { key: 'hot', label: 'Hot' },
  { key: 'new', label: 'New' },
  { key: 'top', label: 'Top' },
  { key: 'following', label: 'Following' },
];

function timeAgo(iso: string): string {
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

export default function CommunityScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { session, loading: authLoading } = useAuth();

  const [sort, setSort] = useState<FeedSort>('hot');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [canPost, setCanPost] = useState(false);

  const load = useCallback(async (s: FeedSort) => {
    setLoading(true);
    const rows = await getFeed(s);
    setPosts(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(sort);
  }, [sort, load]);

  useEffect(() => {
    if (!session) {
      setCanPost(false);
      return;
    }
    void getMyProfile().then((p) => setCanPost(Boolean(p?.isPublic)));
  }, [session]);

  return (
    <Screen art={Art.sandwich} wide header={<AppHeader active="community" />}>
      <View style={styles.top}>
        <Heading style={{ flex: 1 }}>Community</Heading>
        <PressableScale
          onPress={() => {
            if (!session) {
              router.push('/auth');
              return;
            }
            router.push('/compose');
          }}
          to={0.9}
        >
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.accentMuted }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 20, color: palette.accent }}>+</Text>
          </View>
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
        <Reveal>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {SORTS.map((s) => (
              <Chip
                key={s.key}
                label={s.label}
                selected={sort === s.key}
                onPress={() => {
                  if (!session && s.key === 'following') {
                    router.push('/auth');
                    return;
                  }
                  setSort(s.key);
                }}
              />
            ))}
          </View>
        </Reveal>

        {!authLoading && session && !canPost && (
          <Reveal delay={40}>
            <GlassCard style={{ gap: Spacing.two }}>
              <Small color={palette.textSecondary}>
                Make your profile public to post and comment — your name and photo need to be visible for others to see your posts.
              </Small>
              <Button title="Go to profile" variant="secondary" onPress={() => router.push('/profile')} />
            </GlassCard>
          </Reveal>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.accent} />
            <Small color={palette.textSecondary}>Loading the feed…</Small>
          </View>
        ) : posts.length === 0 ? (
          <Reveal delay={80}>
            <GlassCard style={{ gap: Spacing.two }}>
              <Small color={palette.textSecondary}>
                {sort === 'following' ? 'Follow other home cooks to see their posts here.' : 'Nothing here yet — be the first to share something.'}
              </Small>
            </GlassCard>
          </Reveal>
        ) : (
          posts.map((post, i) => (
            <Reveal key={post.id} delay={Math.min(i, 6) * 30}>
              <PostCard post={post} onOpen={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })} />
            </Reveal>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
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
    <GlassCard style={{ gap: Spacing.three }}>
      <PressableScale onPress={onOpen} to={0.99}>
        <View style={{ gap: Spacing.two }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Avatar name={post.author.displayName || post.author.username} uri={post.author.avatarUrl} size={28} />
            <Body numberOfLines={1} style={{ fontFamily: Type.bodySemibold, flexShrink: 1 }}>
              {post.author.displayName || post.author.username}
            </Body>
            {post.author.isPro && <Text style={{ fontFamily: Type.bodySemibold, fontSize: 10, color: palette.accent }}>PRO ✦</Text>}
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
        </View>
      </PressableScale>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
        <View style={[styles.voteRow, { borderColor: palette.border }]}>
          <PressableScale onPress={() => cast(1)} to={0.9}>
            <Text style={{ fontSize: 16, color: myVote === 1 ? palette.accent : palette.textSecondary }}>▲</Text>
          </PressableScale>
          <Text style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.text, minWidth: 20, textAlign: 'center' }}>{score}</Text>
          <PressableScale onPress={() => cast(-1)} to={0.9}>
            <Text style={{ fontSize: 16, color: myVote === -1 ? palette.blue : palette.textSecondary }}>▼</Text>
          </PressableScale>
        </View>
        <PressableScale onPress={onOpen} to={0.95}>
          <Small color={palette.textSecondary}>{post.commentCount} comment{post.commentCount === 1 ? '' : 's'}</Small>
        </PressableScale>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  postImage: { width: '100%', height: 180, borderRadius: 14 },
  recipeChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
