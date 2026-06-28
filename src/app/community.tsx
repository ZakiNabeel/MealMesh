/**
 * Reddit-style community feed — Hot / New / Top / Following. Posting and
 * commenting require a public profile (so the author's name/avatar can
 * actually resolve for other viewers); reading and voting never do.
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Art } from '@/components/art';
import { LeaderboardCard } from '@/components/DashboardCards';
import { Avatar, Body, Button, Chip, Eyebrow, GlassCard, Heading, PressableScale, ProBadge, Reveal, Screen, Small, useIsDesktop } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getFeed } from '@/lib/community';
import { getLeaderboard, getMyProfile, getMyRank } from '@/lib/social';
import { usePalette } from '@/theme/use-theme';
import type { FeedSort, LeaderboardEntry, Post } from '@/types';

const SORTS: { key: FeedSort; label: string }[] = [
  { key: 'hot', label: 'Hot' },
  { key: 'new', label: 'New' },
  { key: 'top', label: 'Top' },
  { key: 'following', label: 'Following' },
];

export default function CommunityScreen() {
  const router = useRouter();
  const palette = usePalette();
  const isDesktop = useIsDesktop();
  const { session, loading: authLoading } = useAuth();

  const [sort, setSort] = useState<FeedSort>('hot');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [canPost, setCanPost] = useState(false);
  const [topCooks, setTopCooks] = useState<LeaderboardEntry[]>([]);
  const [rank, setRank] = useState<{ rank: number; totalPoints: number } | null>(null);

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
    void getLeaderboard('global').then((rows) => setTopCooks(rows.slice(0, 5)));
  }, []);

  useEffect(() => {
    if (!session) {
      setCanPost(false);
      setRank(null);
      return;
    }
    void getMyProfile().then((p) => setCanPost(Boolean(p?.isPublic)));
    void getMyRank().then(setRank);
  }, [session]);

  const composeButton = (
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
  );

  const feed = (
    <View style={{ gap: Spacing.four }}>
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
    </View>
  );

  const rail = (
    <View style={{ gap: Spacing.four }}>
      <Reveal delay={60}>
        <GlassCard style={{ gap: Spacing.three }}>
          <Eyebrow>Top cooks</Eyebrow>
          {topCooks.length === 0 ? (
            <Small color={palette.textSecondary}>No public cooks yet — be the first.</Small>
          ) : (
            <View style={{ gap: Spacing.two }}>
              {topCooks.map((e, i) => (
                <PressableScale key={e.userId} onPress={() => router.push({ pathname: '/u/[username]', params: { username: e.username } })} to={0.98}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                    <Text style={{ fontFamily: Type.displayBold, fontSize: 13, color: palette.textSecondary, width: 18 }}>{i + 1}</Text>
                    <Avatar name={e.displayName || e.username} uri={e.avatarUrl} size={24} />
                    <Body numberOfLines={1} style={{ fontFamily: Type.bodySemibold, flexShrink: 1, flex: 1 }}>
                      {e.displayName || e.username}
                    </Body>
                    {e.isPro && <ProBadge size={12} />}
                    <Small color={palette.textSecondary}>{e.totalPoints}</Small>
                  </View>
                </PressableScale>
              ))}
            </View>
          )}
          <Button title="View leaderboard" variant="secondary" onPress={() => router.push('/leaderboard')} />
        </GlassCard>
      </Reveal>

      <Reveal delay={100}>
        <GlassCard style={{ gap: Spacing.two }}>
          <Eyebrow>Community guidelines</Eyebrow>
          <Small color={palette.textSecondary}>Be kind, share real cooking, and credit recipes you didn&apos;t create. Report anything that breaks these.</Small>
        </GlassCard>
      </Reveal>
    </View>
  );

  return (
    <Screen art={Art.sandwich} wide maxWidth={1280} header={<AppHeader active="community" />}>
      <View style={styles.top}>
        <Heading style={{ flex: 1 }}>Community</Heading>
        {composeButton}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four }}>
        {isDesktop ? (
          <View style={styles.row}>
            {session && (
              <View style={styles.leftRail}>
                <Reveal delay={40}>
                  <LeaderboardCard rank={rank} onOpen={() => router.push('/leaderboard')} />
                </Reveal>
              </View>
            )}
            <View style={styles.main}>{feed}</View>
            <View style={styles.rail}>{rail}</View>
          </View>
        ) : (
          feed
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.four, alignItems: 'flex-start' },
  leftRail: { width: 280, flexShrink: 0, gap: Spacing.four },
  main: { flex: 1.6, minWidth: 0 },
  rail: { flex: 1, gap: Spacing.four, minWidth: 280 },
});
