/**
 * The signed-in user's own public identity + cooking stats. This is the hub for
 * editing the profile (username, display name, bio, avatar) and the opt-in
 * "make me public" switch. Stats (points, streak, badges) are derived on read
 * from the cooking logs by the gamification engine — never stored, so they can
 * never drift. NOTHING here touches dietary/medical data (context §10).
 */

import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Art } from '@/components/art';
import { ArticlesRail } from '@/components/ArticlesRail';
import { CommunityCard, LeaderboardCard } from '@/components/DashboardCards';
import { Avatar, Body, Button, Chip, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small, useIsDesktop } from '@/components/ui';
import { ProfileHeader } from '@/components/ProfileHeader';
import { ProfileTabs } from '@/components/ProfileTabs';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getFeed, getPostsByAuthor } from '@/lib/community';
import { REGIONS } from '@/lib/dietLibrary';
import { lifetimeStats } from '@/lib/gamification';
import { pickAndUploadImage } from '@/lib/imageUpload';
import { getAllLogs, getFollowCounts, getMyProfile, getMyRank, isValidUsername, updateProfile } from '@/lib/social';
import { usePalette } from '@/theme/use-theme';
import type { CookingStats, FollowCounts, Post, Profile, Region } from '@/types';

export default function ProfileScreen() {
  const router = useRouter();
  const palette = usePalette();
  const isDesktop = useIsDesktop();
  const { session, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<CookingStats | null>(null);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [rank, setRank] = useState<{ rank: number; totalPoints: number } | null>(null);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, logs, myRank, recent] = await Promise.all([getMyProfile(), getAllLogs(), getMyRank(), getFeed('new')]);
    setProfile(p);
    setRank(myRank);
    setRecentPosts(recent.slice(0, 3));
    const lifetime = lifetimeStats(logs, new Date().toISOString().slice(0, 10));
    setStats({
      totalPoints: lifetime.totalPoints,
      currentStreak: lifetime.streak.current,
      longestStreak: lifetime.streak.longest,
      mealsLogged: lifetime.mealsLogged,
      cleanPlateDays: lifetime.cleanPlateDays,
      perfectWeeks: lifetime.perfectWeeks,
    });
    if (p) {
      setCounts(await getFollowCounts(p.userId));
      setPostsLoading(true);
      setPosts(await getPostsByAuthor(p.userId));
      setPostsLoading(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    void load();
  }, [session, authLoading, load]);

  if (!authLoading && !session) {
    return (
      <Screen art={Art.tacos}>
        <View style={styles.center}>
          <Heading>Your profile</Heading>
          <Body color={palette.textSecondary} style={{ textAlign: 'center' }}>
            Sign in to track meals you&apos;ve cooked, earn badges, and build a streak.
          </Body>
          <Button title="Sign in" onPress={() => router.push('/auth')} />
        </View>
      </Screen>
    );
  }

  if (loading || !profile || !stats) {
    return (
      <Screen art={Art.tacos}>
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
          <Small color={palette.textSecondary}>Loading your profile…</Small>
        </View>
      </Screen>
    );
  }

  const mainContent = (
    <>
      <Reveal>
        <GlassCard style={{ padding: 0 }}>
          <ProfileHeader
            profile={profile}
            counts={counts}
            actions={
              <View style={{ flexDirection: 'row', gap: Spacing.three }}>
                <View style={{ flex: 1 }}>
                  <Button title="Edit profile" variant="secondary" onPress={() => setEditing(true)} />
                </View>
                {!profile.isPro && (
                  <View style={{ flex: 1 }}>
                    <Button title="Go Pro ✦" onPress={() => router.push('/paywall')} />
                  </View>
                )}
              </View>
            }
          >
            <View style={[styles.visibility, { borderColor: palette.border }]}>
              <Text style={{ fontFamily: Type.bodyMedium, fontSize: 12, color: palette.textSecondary }}>
                {profile.isPublic ? '🌐 Public profile' : '🔒 Private — only you can see this'}
              </Text>
            </View>
          </ProfileHeader>
        </GlassCard>
      </Reveal>

      <Reveal delay={80}>
        <ProfileTabs
          posts={posts}
          postsLoading={postsLoading}
          stats={stats}
          onOpenPost={(post) => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
        />
      </Reveal>

      {!profile.isPublic && (
        <Reveal delay={240}>
          <GlassCard style={{ gap: Spacing.two }}>
            <Body style={{ fontFamily: Type.bodySemibold }}>Join the community</Body>
            <Small>
              Make your profile public to share cooked meals, follow other home cooks, and climb the leaderboard
              (coming soon). Your dietary settings always stay private.
            </Small>
            <Button title="Edit profile to go public" variant="secondary" onPress={() => setEditing(true)} />
          </GlassCard>
        </Reveal>
      )}
    </>
  );

  return (
    <Screen art={Art.tacos} wide maxWidth={1280} header={<AppHeader />}>
      <View style={styles.top}>
        <Heading>Profile</Heading>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
        {editing ? (
          <ProfileEditor
            profile={profile}
            onCancel={() => setEditing(false)}
            onSaved={(p) => {
              setProfile(p);
              setEditing(false);
            }}
          />
        ) : isDesktop ? (
          <View style={styles.triRow}>
            <View style={styles.triRail}>
              <Reveal delay={60}>
                <LeaderboardCard rank={rank} onOpen={() => router.push('/leaderboard')} />
              </Reveal>
              <Reveal delay={100}>
                <CommunityCard
                  posts={recentPosts}
                  onOpenPost={(id) => router.push({ pathname: '/post/[id]', params: { id } })}
                  onOpenAll={() => router.push('/community')}
                />
              </Reveal>
            </View>
            <View style={styles.triMain}>{mainContent}</View>
            <View style={styles.triRail}>
              <Reveal delay={140}>
                <ArticlesRail />
              </Reveal>
            </View>
          </View>
        ) : (
          mainContent
        )}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                             */
/* ------------------------------------------------------------------ */

function ProfileEditor({ profile, onCancel, onSaved }: { profile: Profile; onCancel: () => void; onSaved: (p: Profile) => void }) {
  const palette = usePalette();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [isPublic, setIsPublic] = useState(profile.isPublic);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);
  const [coverUrl, setCoverUrl] = useState<string | null>(profile.coverUrl);
  const [region, setRegion] = useState<Region | null>((profile.region as Region | null) ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeAvatar = async () => {
    setUploading(true);
    setError(null);
    const res = await pickAndUploadImage('avatars', { square: true });
    setUploading(false);
    if ('url' in res) setAvatarUrl(res.url);
    else if ('error' in res) setError(res.error);
  };

  const changeCover = async () => {
    setUploadingCover(true);
    setError(null);
    const res = await pickAndUploadImage('covers', { aspect: [3, 1] });
    setUploadingCover(false);
    if ('url' in res) setCoverUrl(res.url);
    else if ('error' in res) setError(res.error);
  };

  const save = async () => {
    if (!isValidUsername(username.trim().toLowerCase())) {
      setError('Username must be 3–20 letters, numbers or underscores.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateProfile({ displayName, username, bio: bio.trim() || null, isPublic, avatarUrl, coverUrl, region });
    setSaving(false);
    if (res.error) setError(res.error);
    else if (res.profile) onSaved(res.profile);
  };

  return (
    <Reveal>
      <GlassCard style={{ gap: Spacing.three }}>
        <View style={{ marginHorizontal: -Spacing.four, marginTop: -Spacing.four }}>
          <PressableScale onPress={changeCover} to={0.98} disabled={uploadingCover}>
            <View>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} resizeMode="cover" style={styles.editorBanner} />
              ) : (
                <LinearGradient colors={[palette.blobA, palette.blobB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.editorBanner} />
              )}
              <View style={[styles.bannerBadge, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <Small>{uploadingCover ? 'Uploading…' : '📷 Change cover'}</Small>
              </View>
            </View>
          </PressableScale>

          <View style={{ paddingHorizontal: Spacing.four }}>
            <PressableScale onPress={changeAvatar} to={0.96} disabled={uploading} style={{ alignSelf: 'flex-start' }}>
              <View style={[styles.avatarRing, { borderColor: palette.background, backgroundColor: palette.background }]}>
                <Avatar name={displayName || username} uri={avatarUrl} size={80} />
                <View style={[styles.avatarBadge, { backgroundColor: palette.background, borderColor: palette.border }]}>
                  <Small>{uploading ? '…' : '📷'}</Small>
                </View>
              </View>
            </PressableScale>
          </View>
        </View>

        <Field label="Display name">
          <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={palette.textSecondary} style={inputStyle(palette)} />
        </Field>

        <Field label="Username">
          <TextInput
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase())}
            autoCapitalize="none"
            placeholder="username"
            placeholderTextColor={palette.textSecondary}
            style={inputStyle(palette)}
          />
        </Field>

        <Field label="Bio">
          <TextInput value={bio} onChangeText={setBio} placeholder="A line about your cooking" placeholderTextColor={palette.textSecondary} multiline style={[inputStyle(palette), { minHeight: 64, textAlignVertical: 'top' }]} />
        </Field>

        <Field label="Region (for the regional leaderboard)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {Object.values(REGIONS).map((r) => (
              <Chip key={r.region} label={r.label} selected={region === r.region} onPress={() => setRegion(r.region === region ? null : r.region)} />
            ))}
          </View>
        </Field>

        <View style={[styles.toggleRow, { borderColor: palette.border }]}>
          <View style={{ flex: 1 }}>
            <Body style={{ fontFamily: Type.bodySemibold }}>Public profile</Body>
            <Small color={palette.textSecondary}>Others can find you and see your cooking. Dietary settings stay private.</Small>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: palette.accent }} />
        </View>

        {error && <Small color={palette.blue}>{error}</Small>}

        <View style={{ flexDirection: 'row', gap: Spacing.three }}>
          <View style={{ flex: 1 }}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={saving ? 'Saving…' : 'Save'} disabled={saving} onPress={save} />
          </View>
        </View>
      </GlassCard>
    </Reveal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </View>
  );
}

function inputStyle(palette: ReturnType<typeof usePalette>) {
  return { borderWidth: 1, borderColor: palette.border, borderRadius: Radius.md, padding: Spacing.three, fontFamily: Type.body, fontSize: 15, color: palette.text, backgroundColor: palette.card };
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  triRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.four },
  triRail: { width: 280, flexShrink: 0, gap: Spacing.four },
  triMain: { flex: 1, minWidth: 0, gap: Spacing.four },
  visibility: { alignSelf: 'flex-start', marginTop: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
  editorBanner: { height: 110 },
  bannerBadge: { position: 'absolute', right: Spacing.three, bottom: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  avatarRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, marginTop: -44, alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
