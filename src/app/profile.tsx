/**
 * The signed-in user's own public identity + cooking stats. This is the hub for
 * editing the profile (username, display name, bio, avatar) and the opt-in
 * "make me public" switch. Stats (points, streak, badges) are derived on read
 * from the cooking logs by the gamification engine — never stored, so they can
 * never drift. NOTHING here touches dietary/medical data (context §10).
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Art } from '@/components/art';
import { Avatar, Body, Button, Chip, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { REGIONS } from '@/lib/dietLibrary';
import { lifetimeStats, type LifetimeStats } from '@/lib/gamification';
import { pickAndUploadImage } from '@/lib/imageUpload';
import { getAllLogs, getMyProfile, isValidUsername, updateProfile } from '@/lib/social';
import { useSubscription } from '@/lib/subscription';
import { usePalette } from '@/theme/use-theme';
import type { Profile, Region } from '@/types';

export default function ProfileScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { session, loading: authLoading } = useAuth();
  const { isPro } = useSubscription();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, logs] = await Promise.all([getMyProfile(), getAllLogs()]);
    setProfile(p);
    setStats(lifetimeStats(logs, new Date().toISOString().slice(0, 10)));
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

  return (
    <Screen art={Art.tacos} wide>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
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
        ) : (
          <>
            <Reveal>
              <GlassCard style={{ gap: Spacing.three, alignItems: 'center' }}>
                <Avatar name={profile.displayName || profile.username} uri={profile.avatarUrl} size={96} />
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Heading>{profile.displayName || profile.username}</Heading>
                    {isPro && (
                      <View style={[styles.proPill, { backgroundColor: palette.accentMuted }]}>
                        <Text style={{ fontFamily: Type.bodySemibold, fontSize: 11, color: palette.accent }}>PRO ✦</Text>
                      </View>
                    )}
                  </View>
                  <Small color={palette.textSecondary}>@{profile.username}</Small>
                  {profile.bio ? <Body style={{ textAlign: 'center', marginTop: 4 }}>{profile.bio}</Body> : null}
                </View>
                <View style={[styles.visibility, { borderColor: palette.border }]}>
                  <Text style={{ fontFamily: Type.bodyMedium, fontSize: 12, color: palette.textSecondary }}>
                    {profile.isPublic ? '🌐 Public profile' : '🔒 Private — only you can see this'}
                  </Text>
                </View>
                <Button title="Edit profile" variant="secondary" onPress={() => setEditing(true)} />
              </GlassCard>
            </Reveal>

            <Reveal delay={80}>
              <View style={{ gap: Spacing.two }}>
                <Eyebrow>Your stats</Eyebrow>
                <View style={styles.statGrid}>
                  <StatCard label="Points" value={stats.totalPoints} accent />
                  <StatCard label="Day streak" value={stats.streak.current} suffix="🔥" />
                  <StatCard label="Meals cooked" value={stats.mealsLogged} />
                  <StatCard label="Longest streak" value={stats.streak.longest} />
                </View>
              </View>
            </Reveal>

            <Reveal delay={160}>
              <View style={{ gap: Spacing.two }}>
                <Eyebrow>Badges</Eyebrow>
                <GlassCard style={{ gap: Spacing.three }}>
                  <BadgeRow
                    icon="🍽️"
                    title="Clean-Plate Days"
                    subtitle="Cooked all four meals in a day"
                    count={stats.cleanPlateDays}
                  />
                  <View style={[styles.divider, { backgroundColor: palette.border }]} />
                  <BadgeRow
                    icon="🏆"
                    title="Perfect Weeks"
                    subtitle="Cooked every meal, all week"
                    count={stats.perfectWeeks}
                  />
                </GlassCard>
              </View>
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
        )}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                             */
/* ------------------------------------------------------------------ */

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

function BadgeRow({ icon, title, subtitle, count }: { icon: string; title: string; subtitle: string; count: number }) {
  const palette = usePalette();
  const earned = count > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
      <View style={[styles.badgeIcon, { backgroundColor: earned ? palette.accentMuted : palette.backgroundElement, opacity: earned ? 1 : 0.5 }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Body style={{ fontFamily: Type.bodySemibold }}>{title}</Body>
        <Small color={palette.textSecondary}>{subtitle}</Small>
      </View>
      <Text style={{ fontFamily: Type.displayBold, fontSize: 20, color: earned ? palette.accent : palette.textSecondary }}>×{count}</Text>
    </View>
  );
}

function ProfileEditor({ profile, onCancel, onSaved }: { profile: Profile; onCancel: () => void; onSaved: (p: Profile) => void }) {
  const palette = usePalette();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [isPublic, setIsPublic] = useState(profile.isPublic);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);
  const [region, setRegion] = useState<Region | null>((profile.region as Region | null) ?? null);
  const [uploading, setUploading] = useState(false);
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

  const save = async () => {
    if (!isValidUsername(username.trim().toLowerCase())) {
      setError('Username must be 3–20 letters, numbers or underscores.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateProfile({ displayName, username, bio: bio.trim() || null, isPublic, avatarUrl, region });
    setSaving(false);
    if (res.error) setError(res.error);
    else if (res.profile) onSaved(res.profile);
  };

  return (
    <Reveal>
      <GlassCard style={{ gap: Spacing.three }}>
        <View style={{ alignItems: 'center', gap: Spacing.two }}>
          <Avatar name={displayName || username} uri={avatarUrl} size={88} />
          <PressableScale onPress={changeAvatar} to={0.96} disabled={uploading}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 14, color: palette.accent }}>
              {uploading ? 'Uploading…' : 'Change photo'}
            </Text>
          </PressableScale>
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
  proPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  visibility: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  statCard: { flexGrow: 1, flexBasis: '45%', minWidth: 140, gap: 2, alignItems: 'flex-start' },
  badgeIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, width: '100%' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
});
