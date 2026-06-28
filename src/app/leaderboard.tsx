/**
 * Ranked cooking leaderboard — Global / Friends / Region / Crew. Rows are a
 * public-safe projection (username, avatar, points, streak, Pro flair) with
 * zero dietary/medical data (context §10). Crew creation is a Pro perk;
 * joining a crew by invite code is free for everyone.
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Art } from '@/components/art';
import { CommunityCard } from '@/components/DashboardCards';
import { Avatar, Body, Button, Chip, Eyebrow, GlassCard, Heading, PressableScale, ProBadge, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getFeed } from '@/lib/community';
import { getMyCrew, getLeaderboard, createCrew, joinCrewByCode, leaveCrew } from '@/lib/social';
import { useSubscription } from '@/lib/subscription';
import { usePalette } from '@/theme/use-theme';
import type { Crew, LeaderboardEntry, LeaderboardScope, Post } from '@/types';

const SCOPES: { key: LeaderboardScope; label: string }[] = [
  { key: 'global', label: 'Global' },
  { key: 'friends', label: 'Friends' },
  { key: 'region', label: 'Region' },
  { key: 'crew', label: 'Crew' },
];

export default function LeaderboardScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { session, loading: authLoading } = useAuth();
  const { isPro } = useSubscription();

  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [crew, setCrew] = useState<Crew | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);

  const load = useCallback(async (s: LeaderboardScope) => {
    setLoading(true);
    const [rows, myCrew] = await Promise.all([getLeaderboard(s), getMyCrew()]);
    setEntries(rows);
    setCrew(myCrew);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(scope);
  }, [scope, load]);

  useEffect(() => {
    void getFeed('new').then((p) => setRecentPosts(p.slice(0, 3)));
  }, []);

  const mainContent = (
    <>
      <Reveal>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {SCOPES.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              selected={scope === s.key}
              onPress={() => {
                if (!session && s.key !== 'global') {
                  router.push('/auth');
                  return;
                }
                setScope(s.key);
              }}
            />
          ))}
        </View>
      </Reveal>

      {!authLoading && !session && scope === 'global' && (
        <Reveal delay={40}>
          <GlassCard style={{ gap: Spacing.two }}>
            <Small color={palette.textSecondary}>Sign in to follow friends, set a region, and join a Crew.</Small>
            <Button title="Sign in" variant="secondary" onPress={() => router.push('/auth')} />
          </GlassCard>
        </Reveal>
      )}

      {scope === 'crew' && session && (
        <Reveal delay={40}>
          <CrewPanel
            crew={crew}
            isPro={isPro}
            onChanged={() => load('crew')}
          />
        </Reveal>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
          <Small color={palette.textSecondary}>Loading rankings…</Small>
        </View>
      ) : scope === 'crew' && session && !crew ? null : (
        <Reveal delay={80}>
          <RankedList
            entries={entries}
            scope={scope}
            onOpen={(username) => router.push({ pathname: '/u/[username]', params: { username } })}
          />
        </Reveal>
      )}

      <Reveal delay={120}>
        <CommunityCard
          posts={recentPosts}
          onOpenPost={(id) => router.push({ pathname: '/post/[id]', params: { id } })}
          onOpenAll={() => router.push('/community')}
        />
      </Reveal>
    </>
  );

  return (
    <Screen art={Art.steak} rail header={<AppHeader active="leaderboard" />}>
      <View style={styles.top}>
        <Heading>Leaderboard</Heading>
        <Small color={palette.textSecondary}>Cook, log meals, and climb the board.</Small>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
        {mainContent}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function emptyMessage(scope: LeaderboardScope): string {
  switch (scope) {
    case 'friends':
      return 'Follow other home cooks to see them here.';
    case 'region':
      return 'Set a region on your profile to see a regional board, or no one in your region is public yet.';
    case 'crew':
      return 'Your crew has no ranked cooks yet.';
    default:
      return 'No public cooks yet — be the first to show up here!';
  }
}

function RankedList({
  entries,
  scope,
  onOpen,
}: {
  entries: LeaderboardEntry[];
  scope: LeaderboardScope;
  onOpen: (username: string) => void;
}) {
  const palette = usePalette();
  if (entries.length === 0) {
    return (
      <GlassCard style={{ gap: Spacing.two }}>
        <Small color={palette.textSecondary}>{emptyMessage(scope)}</Small>
      </GlassCard>
    );
  }
  return (
    <GlassCard style={{ gap: 0, paddingVertical: Spacing.one, paddingHorizontal: Spacing.one }}>
      {entries.map((e, i) => (
        <PressableScale key={e.userId} onPress={() => onOpen(e.username)} to={0.98}>
          <View style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: palette.border }]}>
            <Text style={{ fontFamily: Type.displayBold, fontSize: 15, color: palette.textSecondary, width: 28 }}>
              {i + 1}
            </Text>
            <Avatar name={e.displayName || e.username} uri={e.avatarUrl} size={36} />
            <View style={{ flex: 1, gap: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Body numberOfLines={1} style={{ fontFamily: Type.bodySemibold, flexShrink: 1 }}>
                  {e.displayName || e.username}
                </Body>
                {e.isPro && <ProBadge size={13} />}
              </View>
              <Small color={palette.textSecondary}>@{e.username}</Small>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 1 }}>
              <Text style={{ fontFamily: Type.displayBold, fontSize: 16, color: palette.accent }}>{e.totalPoints}</Text>
              {e.currentStreak > 0 && <Small color={palette.textSecondary}>🔥 {e.currentStreak}</Small>}
            </View>
          </View>
        </PressableScale>
      ))}
    </GlassCard>
  );
}

function CrewPanel({ crew, isPro, onChanged }: { crew: Crew | null; isPro: boolean; onChanged: () => void }) {
  const palette = usePalette();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (crew) {
    return (
      <GlassCard style={{ gap: Spacing.two }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Body style={{ fontFamily: Type.bodySemibold }}>{crew.name}</Body>
          <Small color={palette.textSecondary}>{crew.memberCount} member{crew.memberCount === 1 ? '' : 's'}</Small>
        </View>
        <Small color={palette.textSecondary}>Invite code: {crew.inviteCode}</Small>
        {error && <Small color={palette.blue}>{error}</Small>}
        <Button
          title="Leave crew"
          variant="secondary"
          onPress={async () => {
            setBusy(true);
            await leaveCrew(crew.id);
            setBusy(false);
            onChanged();
          }}
          disabled={busy}
        />
      </GlassCard>
    );
  }

  return (
    <GlassCard style={{ gap: Spacing.three }}>
      <View style={{ gap: Spacing.two }}>
        <Eyebrow>Join a crew</Eyebrow>
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="Invite code"
            placeholderTextColor={palette.textSecondary}
            autoCapitalize="characters"
            style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]}
          />
          <Button
            title="Join"
            variant="secondary"
            disabled={busy || !code.trim()}
            onPress={async () => {
              setBusy(true);
              setError(null);
              const res = await joinCrewByCode(code);
              setBusy(false);
              if (res.error) setError(res.error);
              else onChanged();
            }}
          />
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      <View style={{ gap: Spacing.two }}>
        <Eyebrow>Create a crew</Eyebrow>
        {isPro ? (
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Crew name"
              placeholderTextColor={palette.textSecondary}
              style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]}
            />
            <Button
              title="Create"
              disabled={busy || !name.trim()}
              onPress={async () => {
                setBusy(true);
                setError(null);
                const res = await createCrew(name);
                setBusy(false);
                if (res.error) setError(res.error);
                else onChanged();
              }}
            />
          </View>
        ) : (
          <Small color={palette.textSecondary}>Creating a crew is a Pro perk — joining one is free for everyone.</Small>
        )}
      </View>

      {error && <Small color={palette.blue}>{error}</Small>}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  top: { gap: 4, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, paddingHorizontal: Spacing.two },
  divider: { height: 1, width: '100%' },
  input: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 44, fontFamily: Type.body, fontSize: 14 },
});
