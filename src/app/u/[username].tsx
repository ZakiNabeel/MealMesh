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
import { Avatar, Body, Button, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { followUser, getFollowCounts, getPublicProfile, getUserStats, isFollowing, unfollowUser } from '@/lib/social';
import { usePalette } from '@/theme/use-theme';
import type { CookingStats, FollowCounts, Profile } from '@/types';

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { session } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<CookingStats | null>(null);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
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
    const [s, c, isFollowed] = await Promise.all([
      getUserStats(p.userId),
      getFollowCounts(p.userId),
      session ? isFollowing(p.userId) : Promise.resolve(false),
    ]);
    setProfile(p);
    setStats(s);
    setCounts(c);
    setFollowing(isFollowed);
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
            <GlassCard style={{ gap: Spacing.three, alignItems: 'center' }}>
              <Avatar name={profile.displayName || profile.username} uri={profile.avatarUrl} size={96} />
              <View style={{ alignItems: 'center', gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Heading>{profile.displayName || profile.username}</Heading>
                  {profile.isPro && (
                    <View style={[styles.proPill, { backgroundColor: palette.accentMuted }]}>
                      <Text style={{ fontFamily: Type.bodySemibold, fontSize: 11, color: palette.accent }}>PRO ✦</Text>
                    </View>
                  )}
                </View>
                <Small color={palette.textSecondary}>@{profile.username}</Small>
                {profile.bio ? <Body style={{ textAlign: 'center', marginTop: 4 }}>{profile.bio}</Body> : null}
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.four }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: Type.displayBold, fontSize: 18, color: palette.text }}>{counts.followers}</Text>
                  <Small color={palette.textSecondary}>Followers</Small>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: Type.displayBold, fontSize: 18, color: palette.text }}>{counts.following}</Text>
                  <Small color={palette.textSecondary}>Following</Small>
                </View>
              </View>

              {!isMe && (
                <Button
                  title={following ? 'Following ✓' : 'Follow'}
                  variant={following ? 'secondary' : 'primary'}
                  disabled={busy}
                  onPress={toggleFollow}
                />
              )}
            </GlassCard>
          </Reveal>

          {stats && (
            <Reveal delay={80}>
              <View style={{ gap: Spacing.two }}>
                <Eyebrow>Cooking stats</Eyebrow>
                <View style={styles.statGrid}>
                  <StatCard label="Points" value={stats.totalPoints} accent />
                  <StatCard label="Day streak" value={stats.currentStreak} suffix="🔥" />
                  <StatCard label="Meals cooked" value={stats.mealsLogged} />
                  <StatCard label="Longest streak" value={stats.longestStreak} />
                </View>
              </View>
            </Reveal>
          )}

          {stats && (stats.cleanPlateDays > 0 || stats.perfectWeeks > 0) && (
            <Reveal delay={160}>
              <View style={{ gap: Spacing.two }}>
                <Eyebrow>Badges</Eyebrow>
                <GlassCard style={{ gap: Spacing.three }}>
                  <BadgeRow icon="🍽️" title="Clean-Plate Days" count={stats.cleanPlateDays} />
                  <View style={[styles.divider, { backgroundColor: palette.border }]} />
                  <BadgeRow icon="🏆" title="Perfect Weeks" count={stats.perfectWeeks} />
                </GlassCard>
              </View>
            </Reveal>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function StatCard({ label, value, suffix, accent }: { label: string; value: number; suffix?: string; accent?: boolean }) {
  const palette = usePalette();
  return (
    <GlassCard style={styles.statCard}>
      <Text style={{ fontFamily: Type.displayBold, fontSize: 26, color: accent ? palette.accent : palette.text }}>
        {value}
        {suffix ? <Text style={{ fontSize: 16 }}> {suffix}</Text> : null}
      </Text>
      <Small color={palette.textSecondary}>{label}</Small>
    </GlassCard>
  );
}

function BadgeRow({ icon, title, count }: { icon: string; title: string; count: number }) {
  const palette = usePalette();
  const earned = count > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
      <View style={[styles.badgeIcon, { backgroundColor: earned ? palette.accentMuted : palette.backgroundElement, opacity: earned ? 1 : 0.5 }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Body style={{ fontFamily: Type.bodySemibold }}>{title}</Body>
      </View>
      <Text style={{ fontFamily: Type.displayBold, fontSize: 20, color: earned ? palette.accent : palette.textSecondary }}>×{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  proPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  statCard: { flexGrow: 1, flexBasis: '45%', minWidth: 140, gap: 2, alignItems: 'flex-start' },
  badgeIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, width: '100%' },
});
