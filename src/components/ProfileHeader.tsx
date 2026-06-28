/**
 * Twitter/X-style profile header — gradient banner behind an overlapping
 * avatar, name + Pro check + handle, bio, joined date, and a following/
 * follower stat row. Shared by the signed-in user's own profile
 * (src/app/profile.tsx) and any public profile (src/app/u/[username].tsx).
 */

import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Avatar, Body, Heading, PressableScale, ProBadge, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/theme/use-theme';
import type { FollowCounts, Profile } from '@/types';

function joinedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function ProfileHeader({
  profile,
  counts,
  actions,
  children,
}: {
  profile: Profile;
  counts: FollowCounts;
  /** Edit-profile / Follow button row, rendered under the bio + stats. */
  actions?: ReactNode;
  /** Owner-only extras (e.g. the public/private visibility pill). */
  children?: ReactNode;
}) {
  const palette = usePalette();
  const router = useRouter();
  return (
    <View>
      {profile.coverUrl ? (
        <Image source={{ uri: profile.coverUrl }} resizeMode="cover" style={styles.banner} />
      ) : (
        <LinearGradient colors={[palette.blobA, palette.blobB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner} />
      )}
      <View style={styles.body}>
        <View style={[styles.avatarRing, { borderColor: palette.background, backgroundColor: palette.background }]}>
          <Avatar name={profile.displayName || profile.username} uri={profile.avatarUrl} size={80} />
        </View>

        <View style={{ gap: 2, marginTop: Spacing.two }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Heading numberOfLines={1}>{profile.displayName || profile.username}</Heading>
            {profile.isPro && <ProBadge />}
          </View>
          <Small color={palette.textSecondary}>@{profile.username}</Small>
        </View>

        {profile.bio ? <Body style={{ marginTop: Spacing.two }}>{profile.bio}</Body> : null}

        <Small color={palette.textSecondary} style={{ marginTop: Spacing.two }}>
          Joined {joinedLabel(profile.createdAt)}
        </Small>

        <View style={{ flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.three }}>
          <PressableScale onPress={() => router.push({ pathname: '/connections/[username]', params: { username: profile.username, tab: 'following' } })}>
            <Text>
              <Text style={{ fontFamily: Type.bodyBold, color: palette.text }}>{counts.following}</Text>
              <Text style={{ fontFamily: Type.body, color: palette.textSecondary }}> Following</Text>
            </Text>
          </PressableScale>
          <PressableScale onPress={() => router.push({ pathname: '/connections/[username]', params: { username: profile.username, tab: 'followers' } })}>
            <Text>
              <Text style={{ fontFamily: Type.bodyBold, color: palette.text }}>{counts.followers}</Text>
              <Text style={{ fontFamily: Type.body, color: palette.textSecondary }}> Followers</Text>
            </Text>
          </PressableScale>
        </View>

        {children}
        {actions && <View style={{ marginTop: Spacing.three }}>{actions}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { height: 110, borderRadius: 20 },
  body: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  avatarRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, marginTop: -44, alignItems: 'center', justifyContent: 'center' },
});
