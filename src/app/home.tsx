/**
 * Home — the signed-in dashboard and post-login landing. Pulls the four
 * surfaces together: a "this week's plan" shortcut (or a set-up CTA when there's
 * no household yet, so login never dead-ends), the user's leaderboard standing,
 * recent community posts, and public cooks to follow. Everything here is a
 * public-safe projection — no dietary/medical data (context §10).
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Art } from '@/components/art';
import { CommunityCard, LeaderboardCard } from '@/components/DashboardCards';
import { Avatar, Body, Button, Display, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small, useIsDesktop } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { getFeed } from '@/lib/community';
import { useAuth } from '@/lib/auth';
import { getDraftHousehold } from '@/lib/draft';
import { summarizeWeek } from '@/lib/gamification';
import { followUser, getMyProfile, getMyRank, getSuggestedProfiles, getWeekLogs } from '@/lib/social';
import { currentWeekStart, loadHousehold, loadPlan } from '@/lib/store';
import { usePalette } from '@/theme/use-theme';
import type { Household, MealPlan, Post, Profile } from '@/types';

const TOTAL_SLOTS = 28; // 7 days × 4 meals

export default function HomeScreen() {
  const router = useRouter();
  const palette = usePalette();
  const isDesktop = useIsDesktop();
  const { session, user, loading: authLoading } = useAuth();

  const [name, setName] = useState<string>('');
  const [household, setHousehold] = useState<Household | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [cooked, setCooked] = useState(0);
  const [rank, setRank] = useState<{ rank: number; totalPoints: number } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggested, setSuggested] = useState<Profile[]>([]);

  const load = useCallback(async () => {
    // Recent posts + suggestions don't need a session; the rest do.
    void getFeed('new').then((p) => setPosts(p.slice(0, 3)));
    void getSuggestedProfiles(8).then(setSuggested);

    if (!session) return;
    const [profile, hh, myRank] = await Promise.all([getMyProfile(), loadHousehold(), getMyRank()]);
    setName(profile?.displayName || user?.email?.split('@')[0] || 'there');
    setRank(myRank);

    const home = hh ?? getDraftHousehold();
    setHousehold(home);
    if (home && home.id !== 'draft') {
      const week = currentWeekStart();
      const [savedPlan, logs] = await Promise.all([loadPlan(home.id, week), getWeekLogs(week)]);
      setPlan(savedPlan);
      setCooked(summarizeWeek(logs, week).mealsCooked);
    }
  }, [session, user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const firstName = name || (user?.email?.split('@')[0] ?? '');

  return (
    <Screen art={Art.rice} wide header={<AppHeader active="home" />}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
        <Reveal>
          <View style={{ gap: 4 }}>
            <Eyebrow>{session ? 'Welcome back' : 'Welcome'}</Eyebrow>
            <Display>{session ? `Hi, ${firstName}` : 'Your kitchen, together'}</Display>
            <Body color={palette.textSecondary}>
              {session
                ? 'Your week at a glance — your plan, your standing, and what the community is cooking.'
                : 'Sign in to plan your week, track what you cook, and join the community.'}
            </Body>
          </View>
        </Reveal>

        {isDesktop ? (
          <View style={styles.row}>
            <View style={styles.main}>
              <Reveal delay={60}>
                <PlanCard household={household} plan={plan} cooked={cooked} onOpen={() => router.push('/plan')} onSetup={() => router.push('/onboarding')} signedIn={Boolean(session)} onSignIn={() => router.push('/auth')} />
              </Reveal>
            </View>
            <View style={styles.rail}>
              {session && (
                <Reveal delay={100}>
                  <LeaderboardCard rank={rank} onOpen={() => router.push('/leaderboard')} />
                </Reveal>
              )}
              <Reveal delay={140}>
                <CommunityCard posts={posts} onOpenPost={(id) => router.push({ pathname: '/post/[id]', params: { id } })} onOpenAll={() => router.push('/community')} />
              </Reveal>
            </View>
          </View>
        ) : (
          <>
            <Reveal delay={60}>
              <PlanCard household={household} plan={plan} cooked={cooked} onOpen={() => router.push('/plan')} onSetup={() => router.push('/onboarding')} signedIn={Boolean(session)} onSignIn={() => router.push('/auth')} />
            </Reveal>
            {session && (
              <Reveal delay={100}>
                <LeaderboardCard rank={rank} onOpen={() => router.push('/leaderboard')} />
              </Reveal>
            )}
            <Reveal delay={140}>
              <CommunityCard posts={posts} onOpenPost={(id) => router.push({ pathname: '/post/[id]', params: { id } })} onOpenAll={() => router.push('/community')} />
            </Reveal>
          </>
        )}

        {suggested.length > 0 && (
          <Reveal delay={180}>
            <View style={{ gap: Spacing.three }}>
              <Eyebrow>Suggested cooks to follow</Eyebrow>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.three, paddingRight: Spacing.four }}>
                {suggested.map((p) => (
                  <SuggestedCard
                    key={p.userId}
                    profile={p}
                    canFollow={Boolean(session)}
                    onOpen={() => router.push({ pathname: '/u/[username]', params: { username: p.username } })}
                    onFollowed={() => setSuggested((s) => s.filter((x) => x.userId !== p.userId))}
                    onSignIn={() => router.push('/auth')}
                  />
                ))}
              </ScrollView>
            </View>
          </Reveal>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                              */
/* ------------------------------------------------------------------ */

function PlanCard({
  household,
  plan,
  cooked,
  onOpen,
  onSetup,
  signedIn,
  onSignIn,
}: {
  household: Household | null;
  plan: MealPlan | null;
  cooked: number;
  onOpen: () => void;
  onSetup: () => void;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const palette = usePalette();

  if (!signedIn) {
    return (
      <GlassCard style={{ gap: Spacing.three }}>
        <Eyebrow>This week</Eyebrow>
        <Heading>Build a plan everyone can eat</Heading>
        <Body color={palette.textSecondary}>One weekly plan that works for every diet at your table — and a single grocery list to match.</Body>
        <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
          <Button title="Build our plan" onPress={onSetup} />
          <Button title="Sign in" variant="secondary" onPress={onSignIn} />
        </View>
      </GlassCard>
    );
  }

  if (!household) {
    return (
      <GlassCard style={{ gap: Spacing.three }}>
        <Eyebrow>This week</Eyebrow>
        <Heading>Set up your household</Heading>
        <Body color={palette.textSecondary}>Add who&apos;s at your table and their diets, and we&apos;ll weave one plan everyone can eat.</Body>
        <Button title="Set up your household" onPress={onSetup} />
      </GlassCard>
    );
  }

  const firstMeal = plan?.days?.[0]?.name;
  return (
    <GlassCard style={{ gap: Spacing.three }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>This week&apos;s plan</Eyebrow>
        <Small color={palette.textSecondary}>{cooked}/{TOTAL_SLOTS} cooked</Small>
      </View>
      <Heading numberOfLines={1}>{household.name}</Heading>
      {firstMeal ? (
        <Body color={palette.textSecondary} numberOfLines={1}>Starts with {firstMeal}</Body>
      ) : (
        <Body color={palette.textSecondary}>Open to generate this week&apos;s plan.</Body>
      )}
      <View style={[styles.progressTrack, { backgroundColor: palette.backgroundElement }]}>
        <View style={[styles.progressFill, { width: `${Math.round((cooked / TOTAL_SLOTS) * 100)}%`, backgroundColor: palette.accent }]} />
      </View>
      <Button title="Open plan" onPress={onOpen} />
    </GlassCard>
  );
}

function SuggestedCard({
  profile,
  canFollow,
  onOpen,
  onFollowed,
  onSignIn,
}: {
  profile: Profile;
  canFollow: boolean;
  onOpen: () => void;
  onFollowed: () => void;
  onSignIn: () => void;
}) {
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  return (
    <View style={[styles.suggested, { borderColor: palette.border, backgroundColor: palette.card }]}>
      <PressableScale onPress={onOpen} to={0.97}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Avatar name={profile.displayName || profile.username} uri={profile.avatarUrl} size={52} />
          <Body numberOfLines={1} style={{ fontFamily: Type.bodySemibold, maxWidth: 120, textAlign: 'center' }}>
            {profile.displayName || profile.username}
          </Body>
          <Small color={palette.textSecondary} numberOfLines={1}>@{profile.username}</Small>
        </View>
      </PressableScale>
      <Button
        title="Follow"
        variant="secondary"
        onPress={async () => {
          if (!canFollow) {
            onSignIn();
            return;
          }
          setBusy(true);
          await followUser(profile.userId);
          setBusy(false);
          onFollowed();
        }}
        disabled={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.four, alignItems: 'flex-start' },
  main: { flex: 1.6 },
  rail: { flex: 1, gap: Spacing.four, minWidth: 280 },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 999 },
  suggested: { width: 160, borderWidth: 1, borderRadius: 20, padding: Spacing.three, gap: Spacing.three, alignItems: 'stretch' },
});
