/**
 * Followers/Following list for a username — public-safe `FollowListEntry`
 * rows only (context §10: zero dietary data). Works for both a public
 * profile and the signed-in user's own profile, since both already know
 * their `username` and link here via `ProfileHeader`'s stat row.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { Avatar, Body, Button, Chip, GlassCard, Heading, PressableScale, ProBadge, Reveal, Screen, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { getFollowers, getFollowing, getPublicProfile } from '@/lib/social';
import { usePalette } from '@/theme/use-theme';
import type { FollowListEntry, Profile } from '@/types';

type Tab = 'followers' | 'following';

export default function ConnectionsScreen() {
  const { username, tab } = useLocalSearchParams<{ username: string; tab?: string }>();
  const router = useRouter();
  const palette = usePalette();

  const [activeTab, setActiveTab] = useState<Tab>(tab === 'following' ? 'following' : 'followers');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<FollowListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    const p = await getPublicProfile(String(username ?? ''));
    if (!p) {
      setProfile(null);
      setEntries([]);
      setLoading(false);
      return;
    }
    const rows = t === 'followers' ? await getFollowers(p.userId) : await getFollowing(p.userId);
    setProfile(p);
    setEntries(rows);
    setLoading(false);
  }, [username]);

  useEffect(() => {
    void load(activeTab);
  }, [activeTab, load]);

  return (
    <Screen art={Art.fruits} wide>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <View>
          <Heading>{profile ? profile.displayName || profile.username : 'Connections'}</Heading>
          {profile && <Small color={palette.textSecondary}>@{profile.username}</Small>}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
        <Reveal>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Chip label="Followers" selected={activeTab === 'followers'} onPress={() => setActiveTab('followers')} />
            <Chip label="Following" selected={activeTab === 'following'} onPress={() => setActiveTab('following')} />
          </View>
        </Reveal>

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
        ) : entries.length === 0 ? (
          <Reveal delay={80}>
            <GlassCard style={{ gap: Spacing.two }}>
              <Small color={palette.textSecondary}>
                {activeTab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
              </Small>
            </GlassCard>
          </Reveal>
        ) : (
          <Reveal delay={80}>
            <GlassCard style={{ gap: 0, paddingVertical: Spacing.one, paddingHorizontal: Spacing.one }}>
              {entries.map((e, i) => (
                <PressableScale
                  key={e.userId}
                  onPress={() => router.push({ pathname: '/u/[username]', params: { username: e.username } })}
                  to={0.98}
                >
                  <View style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: palette.border }]}>
                    <Avatar name={e.displayName || e.username} uri={e.avatarUrl} size={40} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Body numberOfLines={1} style={{ fontFamily: Type.bodySemibold, flexShrink: 1 }}>
                          {e.displayName || e.username}
                        </Body>
                        {e.isPro && <ProBadge size={13} />}
                      </View>
                      <Small color={palette.textSecondary}>@{e.username}</Small>
                    </View>
                  </View>
                </PressableScale>
              ))}
            </GlassCard>
          </Reveal>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, paddingHorizontal: Spacing.two },
});
