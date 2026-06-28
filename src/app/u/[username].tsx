/**
 * Public profile view — anyone's cooking identity by @username. Badges,
 * points, streak, and a Follow button. Zero dietary/medical data ever
 * surfaces here (context §10); RLS already enforces that only public (or
 * crewmate) profiles resolve at all.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Button, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { ProfileHeader } from '@/components/ProfileHeader';
import { ProfileTabs } from '@/components/ProfileTabs';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getPostsByAuthor } from '@/lib/community';
import { followUser, getFollowCounts, getPublicProfile, getUserStats, isFollowing, unfollowUser } from '@/lib/social';
import { usePalette } from '@/theme/use-theme';
import type { CookingStats, FollowCounts, Post, Profile } from '@/types';

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { session } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<CookingStats | null>(null);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = await getPublicProfile(String(username ?? ''));
    if (!p) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setPostsLoading(true);
    const [s, c, isFollowed, userPosts] = await Promise.all([
      getUserStats(p.userId),
      getFollowCounts(p.userId),
      session ? isFollowing(p.userId) : Promise.resolve(false),
      getPostsByAuthor(p.userId),
    ]);
    setProfile(p);
    setStats(s);
    setCounts(c);
    setFollowing(isFollowed);
    setPosts(userPosts);
    setPostsLoading(false);
    setLoading(false);
  }, [username, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = async () => {
    if (!profile) return;
    if (!session) {
      router.push('/auth');
      return;
    }
    setBusy(true);
    if (following) {
      await unfollowUser(profile.userId);
      setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
    } else {
      await followUser(profile.userId);
      setCounts((c) => ({ ...c, followers: c.followers + 1 }));
    }
    setFollowing(!following);
    setBusy(false);
  };

  const isMe = session?.user.id === profile?.userId;

  return (
    <Screen art={Art.fruits} wide>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <Heading>Profile</Heading>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
          <Small color={palette.textSecondary}>Loading…</Small>
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <Body style={{ textAlign: 'center' }}>This profile doesn&apos;t exist or isn&apos;t public.</Body>
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
          <Reveal>
            <GlassCard style={{ padding: 0 }}>
              <ProfileHeader
                profile={profile}
                counts={counts}
                actions={
                  !isMe ? (
                    <Button
                      title={following ? 'Following ✓' : 'Follow'}
                      variant={following ? 'secondary' : 'primary'}
                      disabled={busy}
                      onPress={toggleFollow}
                    />
                  ) : undefined
                }
              />
            </GlassCard>
          </Reveal>

          {stats && (
            <Reveal delay={80}>
              <ProfileTabs
                posts={posts}
                postsLoading={postsLoading}
                stats={stats}
                onOpenPost={(post) => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
              />
            </Reveal>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
});
