/**
 * Supabase persistence for the public identity (`profiles`) and cooking logs
 * (`meal_logs`). Mirrors the row-mapping style of `src/lib/store.ts`: explicit
 * row interfaces, all reads/writes run as the signed-in user so RLS guarantees
 * a user only ever touches their own rows (profiles additionally expose public
 * rows for everyone — see migration 0005).
 *
 * Nothing here ever reads or writes a member's dietary constraints: the public
 * identity is deliberately decoupled from the private household (context §10).
 */

import { lifetimeStats } from '@/lib/gamification';
import { supabase } from '@/lib/supabase';
import type { CookingStats, Crew, DayOfWeek, FollowCounts, FollowListEntry, LeaderboardEntry, LeaderboardScope, MealLog, MealSlot, Profile } from '@/types';

/* ------------------------------------------------------------------ */
/* Row shapes                                                         */
/* ------------------------------------------------------------------ */

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  is_public: boolean;
  region: string | null;
  is_pro: boolean;
  created_at: string;
}

interface MealLogRow {
  id: string;
  user_id: string;
  week_start: string;
  day_of_week: DayOfWeek;
  slot: MealSlot;
  meal_name: string;
  photo_url: string | null;
  caption: string | null;
  created_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    bio: row.bio,
    isPublic: row.is_public,
    region: row.region,
    isPro: row.is_pro,
    createdAt: row.created_at,
  };
}

function toMealLog(row: MealLogRow): MealLog {
  return {
    id: row.id,
    userId: row.user_id,
    weekStart: row.week_start,
    dayOfWeek: row.day_of_week,
    slot: row.slot,
    mealName: row.meal_name,
    photoUrl: row.photo_url,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

// getSession() reads the locally-cached session (no network round-trip);
// getUser() always calls the Auth server to revalidate. RLS is the real
// security boundary on every write below, so the cheap local read is safe
// here and avoids stacking an extra ~300-500ms hop onto every call site.
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Profiles                                                           */
/* ------------------------------------------------------------------ */

/** The signed-in user's own profile (auto-created at signup), or null. */
export async function getMyProfile(): Promise<Profile | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  return data ? toProfile(data as ProfileRow) : null;
}

/** A public profile by username (only returns rows the viewer may read). */
export async function getPublicProfile(username: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('username', username.toLowerCase()).maybeSingle();
  return data ? toProfile(data as ProfileRow) : null;
}

interface UserStatsRow {
  user_id: string;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  meals_logged: number;
  clean_plate_days: number;
  perfect_weeks: number;
}

/**
 * Cached cooking totals for any user this viewer may see (self, a public
 * profile, or a crewmate — same `user_stats` RLS that backs the leaderboard).
 * Used on public profile pages, where the viewer can't read raw meal_logs.
 */
export async function getUserStats(userId: string): Promise<CookingStats | null> {
  const { data } = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  const r = data as UserStatsRow;
  return {
    totalPoints: r.total_points,
    currentStreak: r.current_streak,
    longestStreak: r.longest_streak,
    mealsLogged: r.meals_logged,
    cleanPlateDays: r.clean_plate_days,
    perfectWeeks: r.perfect_weeks,
  };
}

export interface ProfileUpdate {
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  isPublic?: boolean;
  region?: string | null;
}

/** Username rule mirrors the DB CHECK in migration 0005. */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

/**
 * Update the signed-in user's profile. Returns the saved profile, or an error
 * string (e.g. a taken username trips the unique constraint). Username is
 * normalized to lowercase and validated before the round-trip.
 */
export async function updateProfile(patch: ProfileUpdate): Promise<{ profile?: Profile; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'Sign in first.' };

  const row: Record<string, unknown> = {};
  if (patch.username !== undefined) {
    const u = patch.username.trim().toLowerCase();
    if (!isValidUsername(u)) return { error: 'Username must be 3–20 letters, numbers or underscores.' };
    row.username = u;
  }
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.isPublic !== undefined) row.is_public = patch.isPublic;
  if (patch.region !== undefined) row.region = patch.region;

  const { data, error } = await supabase.from('profiles').update(row).eq('user_id', userId).select('*').maybeSingle();
  if (error) {
    const taken = /duplicate key|unique/i.test(error.message);
    return { error: taken ? 'That username is already taken.' : error.message };
  }
  return data ? { profile: toProfile(data as ProfileRow) } : { error: 'Could not save profile.' };
}

/* ------------------------------------------------------------------ */
/* Meal logs (cooking)                                                */
/* ------------------------------------------------------------------ */

/**
 * Record that the user cooked one meal. Upserts on (user, week, day, slot) so
 * re-logging the same meal (e.g. to add a photo) updates rather than
 * duplicates. Returns the saved log, or null if not signed in.
 */
export async function logMeal(input: {
  weekStart: string;
  dayOfWeek: DayOfWeek;
  slot: MealSlot;
  mealName: string;
  photoUrl?: string | null;
  caption?: string | null;
}): Promise<MealLog | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data } = await supabase
    .from('meal_logs')
    .upsert(
      {
        user_id: userId,
        week_start: input.weekStart,
        day_of_week: input.dayOfWeek,
        slot: input.slot,
        meal_name: input.mealName,
        photo_url: input.photoUrl ?? null,
        caption: input.caption ?? null,
      },
      { onConflict: 'user_id,week_start,day_of_week,slot' },
    )
    .select('*')
    .maybeSingle();
  await syncUserStats(userId);
  return data ? toMealLog(data as MealLogRow) : null;
}

/** Remove a cooking log (un-mark a meal). */
export async function unlogMeal(input: { weekStart: string; dayOfWeek: DayOfWeek; slot: MealSlot }): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await supabase
    .from('meal_logs')
    .delete()
    .eq('user_id', userId)
    .eq('week_start', input.weekStart)
    .eq('day_of_week', input.dayOfWeek)
    .eq('slot', input.slot);
  await syncUserStats(userId);
}

/** All of the signed-in user's logs for one plan week. */
export async function getWeekLogs(weekStart: string): Promise<MealLog[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data } = await supabase.from('meal_logs').select('*').eq('user_id', userId).eq('week_start', weekStart);
  return (data ?? []).map((r) => toMealLog(r as MealLogRow));
}

/** Every cooking log for the signed-in user (drives lifetime stats + streak). */
export async function getAllLogs(): Promise<MealLog[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data } = await supabase.from('meal_logs').select('*').eq('user_id', userId).order('week_start', { ascending: true });
  return (data ?? []).map((r) => toMealLog(r as MealLogRow));
}

/* ------------------------------------------------------------------ */
/* Cached stats (drives the leaderboard)                              */
/* ------------------------------------------------------------------ */

/**
 * Recompute the signed-in user's lifetime stats from their raw meal_logs and
 * upsert the cache row. Called after every log/unlog so the leaderboard never
 * drifts from the same gamification.ts math that drives the profile screen —
 * meal_logs stays the one source of truth; this table just makes ranking fast.
 */
async function syncUserStats(userId: string): Promise<void> {
  const logs = await getAllLogs();
  const stats = lifetimeStats(logs, new Date().toISOString().slice(0, 10));
  await supabase.from('user_stats').upsert(
    {
      user_id: userId,
      total_points: stats.totalPoints,
      current_streak: stats.streak.current,
      longest_streak: stats.streak.longest,
      meals_logged: stats.mealsLogged,
      clean_plate_days: stats.cleanPlateDays,
      perfect_weeks: stats.perfectWeeks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}

/* ------------------------------------------------------------------ */
/* Follow graph                                                       */
/* ------------------------------------------------------------------ */

export async function followUser(targetUserId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId || userId === targetUserId) return;
  await supabase.from('follows').insert({ follower_id: userId, following_id: targetUserId });
}

export async function unfollowUser(targetUserId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetUserId);
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', userId)
    .eq('following_id', targetUserId)
    .maybeSingle();
  return Boolean(data);
}

export async function getFollowCounts(targetUserId: string): Promise<FollowCounts> {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', targetUserId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', targetUserId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

function toFollowListEntry(p: ProfileRow): FollowListEntry {
  return { userId: p.user_id, username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url, isPro: p.is_pro };
}

/**
 * Profiles for a list of user ids, preserving that order — like the
 * profiles→user_stats two-step elsewhere in this file, `follows` has no
 * direct FK to `profiles` for PostgREST to embed through. Ids the viewer
 * can't read under `profiles_read` RLS (a private, non-crewmate account)
 * simply drop out of the list.
 */
async function profilesForIds(ids: string[]): Promise<FollowListEntry[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from('profiles').select('*').in('user_id', ids);
  const byId = new Map((data ?? []).map((p) => [(p as ProfileRow).user_id, p as ProfileRow]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is ProfileRow => Boolean(p))
    .map(toFollowListEntry);
}

/** Accounts that follow `targetUserId`, most recently followed first. */
export async function getFollowers(targetUserId: string, limit = 50): Promise<FollowListEntry[]> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return profilesForIds((data ?? []).map((r) => (r as { follower_id: string }).follower_id));
}

/** Accounts that `targetUserId` follows, most recently followed first. */
export async function getFollowing(targetUserId: string, limit = 50): Promise<FollowListEntry[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return profilesForIds((data ?? []).map((r) => (r as { following_id: string }).following_id));
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                        */
/* ------------------------------------------------------------------ */

interface StatsRow {
  user_id: string;
  total_points: number;
  current_streak: number;
}

function toEntry(stats: StatsRow, profile: ProfileRow): LeaderboardEntry {
  return {
    userId: profile.user_id,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    isPro: profile.is_pro,
    totalPoints: stats.total_points,
    currentStreak: stats.current_streak,
  };
}

/**
 * Two-step fetch (profiles, then matching user_stats) rather than a
 * PostgREST embed: user_stats and profiles are siblings that both reference
 * auth.users, with no direct FK between them for PostgREST to embed through.
 * Sorting/limiting client-side is fine at this scale.
 */
async function rankProfiles(profiles: ProfileRow[]): Promise<LeaderboardEntry[]> {
  if (profiles.length === 0) return [];
  const ids = profiles.map((p) => p.user_id);
  const { data } = await supabase.from('user_stats').select('user_id, total_points, current_streak').in('user_id', ids);
  const statsByUser = new Map((data ?? []).map((s) => [(s as StatsRow).user_id, s as StatsRow]));
  const entries = profiles.map((p) => toEntry(statsByUser.get(p.user_id) ?? { user_id: p.user_id, total_points: 0, current_streak: 0 }, p));
  entries.sort((a, b) => b.totalPoints - a.totalPoints);
  return entries.slice(0, 50);
}

/** Ranked rows for a scope. Global/region only ever include public profiles. */
export async function getLeaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]> {
  const userId = await currentUserId();

  if (scope === 'global') {
    const { data } = await supabase.from('profiles').select('*').eq('is_public', true).limit(200);
    return rankProfiles((data ?? []) as ProfileRow[]);
  }

  if (scope === 'region') {
    const me = await getMyProfile();
    if (!me?.region) return [];
    const { data } = await supabase.from('profiles').select('*').eq('is_public', true).eq('region', me.region).limit(200);
    return rankProfiles((data ?? []) as ProfileRow[]);
  }

  if (scope === 'friends') {
    if (!userId) return [];
    const { data: followingRows } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
    const ids = Array.from(new Set([...(followingRows ?? []).map((r) => (r as { following_id: string }).following_id), userId]));
    const { data } = await supabase.from('profiles').select('*').in('user_id', ids);
    return rankProfiles((data ?? []) as ProfileRow[]);
  }

  // crew
  if (!userId) return [];
  const crew = await getMyCrew();
  if (!crew) return [];
  const { data: memberRows } = await supabase.from('crew_members').select('user_id').eq('crew_id', crew.id);
  const ids = (memberRows ?? []).map((r) => (r as { user_id: string }).user_id);
  if (ids.length === 0) return [];
  const { data } = await supabase.from('profiles').select('*').in('user_id', ids);
  return rankProfiles((data ?? []) as ProfileRow[]);
}

/**
 * Public profiles to suggest following on the Home dashboard — excludes the
 * viewer and anyone they already follow, ranked by points (most active cooks
 * first). Same profiles→user_stats two-step as the leaderboard.
 */
export async function getSuggestedProfiles(limit = 8): Promise<Profile[]> {
  const userId = await currentUserId();
  const { data } = await supabase.from('profiles').select('*').eq('is_public', true).limit(100);
  let rows = (data ?? []) as ProfileRow[];
  if (userId) {
    const { data: followingRows } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
    const following = new Set((followingRows ?? []).map((r) => (r as { following_id: string }).following_id));
    rows = rows.filter((r) => r.user_id !== userId && !following.has(r.user_id));
  }
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.user_id);
  const { data: stats } = await supabase.from('user_stats').select('user_id, total_points').in('user_id', ids);
  const points = new Map((stats ?? []).map((s) => [(s as StatsRow).user_id, (s as { total_points: number }).total_points]));
  rows.sort((a, b) => (points.get(b.user_id) ?? 0) - (points.get(a.user_id) ?? 0));
  return rows.slice(0, limit).map(toProfile);
}

/**
 * The signed-in user's global standing for the Home card. `rank` is 1-based, or
 * 0 when they're not on the public board (private profile / no points) but we
 * still know their points. Returns null only when signed out or statless.
 */
export async function getMyRank(): Promise<{ rank: number; totalPoints: number } | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const board = await getLeaderboard('global');
  const idx = board.findIndex((e) => e.userId === userId);
  if (idx >= 0) return { rank: idx + 1, totalPoints: board[idx].totalPoints };
  const stats = await getUserStats(userId);
  return stats ? { rank: 0, totalPoints: stats.totalPoints } : null;
}

/* ------------------------------------------------------------------ */
/* Crews (Pro perk: create; free: join)                                */
/* ------------------------------------------------------------------ */

interface CrewRow {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
}

function randomInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** The signed-in user's crew, with a member count — or null if not in one. */
export async function getMyCrew(): Promise<Crew | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data: memberRow } = await supabase.from('crew_members').select('crew_id').eq('user_id', userId).maybeSingle();
  if (!memberRow) return null;
  const crewId = (memberRow as { crew_id: string }).crew_id;
  const { data: crewRow } = await supabase.from('crews').select('*').eq('id', crewId).maybeSingle();
  if (!crewRow) return null;
  const { count } = await supabase.from('crew_members').select('user_id', { count: 'exact', head: true }).eq('crew_id', crewId);
  const c = crewRow as CrewRow;
  return { id: c.id, name: c.name, ownerId: c.owner_id, inviteCode: c.invite_code, memberCount: count ?? 1 };
}

/** Create a new Crew (Pro only — enforced by RLS). Auto-joins the owner. */
export async function createCrew(name: string): Promise<{ crew?: Crew; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'Sign in first.' };
  if (await getMyCrew()) return { error: 'Leave your current crew first.' };

  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = randomInviteCode();
    const { data, error } = await supabase
      .from('crews')
      .insert({ name: name.trim(), owner_id: userId, invite_code: inviteCode })
      .select('*')
      .maybeSingle();
    if (!error && data) {
      const c = data as CrewRow;
      await supabase.from('crew_members').insert({ crew_id: c.id, user_id: userId });
      return { crew: { id: c.id, name: c.name, ownerId: c.owner_id, inviteCode: c.invite_code, memberCount: 1 } };
    }
    if (error && !/duplicate key|unique/i.test(error.message)) {
      return { error: /row-level security/i.test(error.message) ? 'Crews are a Pro feature.' : error.message };
    }
    // Invite-code collision — loop and try a fresh one.
  }
  return { error: 'Could not create crew, try again.' };
}

/** Join a crew by invite code — free for everyone, one crew at a time. */
export async function joinCrewByCode(inviteCode: string): Promise<{ crew?: Crew; error?: string }> {
  const { data, error } = await supabase.rpc('join_crew', { p_invite_code: inviteCode.trim().toUpperCase() });
  if (error) {
    if (/already in a crew/i.test(error.message)) return { error: 'You are already in a crew — leave it first.' };
    if (/invalid invite code/i.test(error.message)) return { error: 'Invalid invite code.' };
    return { error: error.message };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { crew_id: string; crew_name: string } | undefined;
  if (!row) return { error: 'Invalid invite code.' };
  return { crew: { id: row.crew_id, name: row.crew_name, ownerId: '', inviteCode: inviteCode.trim().toUpperCase(), memberCount: 0 } };
}

/** Leave the signed-in user's current crew. */
export async function leaveCrew(crewId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await supabase.from('crew_members').delete().eq('crew_id', crewId).eq('user_id', userId);
}
