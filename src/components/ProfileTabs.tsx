/**
 * Posts / Stats / Badges tab switcher shown under a profile header. Shared by
 * the signed-in user's own profile (src/app/profile.tsx) and any public
 * profile (src/app/u/[username].tsx) so both surfaces stay in lockstep.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PostCard } from '@/components/PostCard';
import { Body, GlassCard, PressableScale, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/theme/use-theme';
import type { CookingStats, Post } from '@/types';

type Tab = 'posts' | 'stats' | 'badges';

export function ProfileTabs({
  posts,
  postsLoading,
  stats,
  onOpenPost,
}: {
  posts: Post[];
  postsLoading: boolean;
  stats: CookingStats;
  onOpenPost: (post: Post) => void;
}) {
  const palette = usePalette();
  const [tab, setTab] = useState<Tab>('posts');

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={[styles.tabBar, { borderColor: palette.border }]}>
        <TabButton label="Posts" active={tab === 'posts'} onPress={() => setTab('posts')} />
        <TabButton label="Stats" active={tab === 'stats'} onPress={() => setTab('stats')} />
        <TabButton label="Badges" active={tab === 'badges'} onPress={() => setTab('badges')} />
      </View>

      {tab === 'posts' &&
        (postsLoading ? (
          <Small color={palette.textSecondary}>Loading posts…</Small>
        ) : posts.length === 0 ? (
          <GlassCard>
            <Small color={palette.textSecondary}>No posts yet.</Small>
          </GlassCard>
        ) : (
          <View style={{ gap: Spacing.three }}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onOpen={() => onOpenPost(post)} />
            ))}
          </View>
        ))}

      {tab === 'stats' && (
        <View style={styles.statGrid}>
          <StatCard label="Points" value={stats.totalPoints} accent />
          <StatCard label="Day streak" value={stats.currentStreak} />
          <StatCard label="Meals cooked" value={stats.mealsLogged} />
          <StatCard label="Longest streak" value={stats.longestStreak} />
        </View>
      )}

      {tab === 'badges' && (
        <GlassCard style={{ gap: Spacing.three }}>
          <BadgeRow title="Clean-Plate Days" subtitle="Cooked all four meals in a day" count={stats.cleanPlateDays} />
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <BadgeRow title="Perfect Weeks" subtitle="Cooked every meal, all week" count={stats.perfectWeeks} />
        </GlassCard>
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <PressableScale onPress={onPress} to={0.97} style={{ flex: 1 }}>
      <View style={[styles.tabButton, active && { borderBottomColor: palette.accent, borderBottomWidth: 2 }]}>
        <Text style={{ fontFamily: active ? Type.bodyBold : Type.bodyMedium, fontSize: 14, color: active ? palette.text : palette.textSecondary }}>
          {label}
        </Text>
      </View>
    </PressableScale>
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

function BadgeRow({ title, subtitle, count }: { title: string; subtitle: string; count: number }) {
  const palette = usePalette();
  const earned = count > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
      <View style={[styles.badgeIcon, { backgroundColor: earned ? palette.accentMuted : palette.backgroundElement, opacity: earned ? 1 : 0.5 }]}>
        <Text style={{ fontFamily: Type.displayBold, fontSize: 18, color: earned ? palette.accent : palette.textSecondary }}>{title.charAt(0)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Body style={{ fontFamily: Type.bodySemibold }}>{title}</Body>
        <Small color={palette.textSecondary}>{subtitle}</Small>
      </View>
      <Text style={{ fontFamily: Type.displayBold, fontSize: 20, color: earned ? palette.accent : palette.textSecondary }}>×{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  statCard: { flexGrow: 1, flexBasis: '45%', minWidth: 140, gap: 2, alignItems: 'flex-start' },
  badgeIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, width: '100%' },
});
