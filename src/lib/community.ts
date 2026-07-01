/**
 * Supabase persistence for the Reddit-style community: posts, comments,
 * votes, recipes, reports, and blocks (migration 0008). Mirrors the
 * row-mapping style of `src/lib/social.ts`.
 *
 * Posting/commenting requires a PUBLIC profile (checked by the UI, not here):
 * `profiles` RLS only resolves a row when it's public, the viewer's own, or a
 * crewmate's — so a private user's name/avatar would otherwise fail to
 * resolve for every other viewer of their post. Voting and reading the feed
 * never requires a public profile, since neither exposes the actor's identity.
 *
 * Community recipes are free-text user content — never run through the
 * engine's `validatePlan` safety pass. That distinction is surfaced in the UI,
 * not enforced here.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { moderateText } from '@/lib/moderation';
import { supabase } from '@/lib/supabase';
import type {
  AuthorSummary,
  Comment,
  CommunityRecipe,
  FeedSort,
  Post,
  PostType,
  VoteTargetType,
} from '@/types';

/* ------------------------------------------------------------------ */
/* Row shapes                                                         */
/* ------------------------------------------------------------------ */

interface RecipeRow {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  ingredients: string[];
  steps: string[];
  cuisine: string | null;
  diet_tags: string[];
  is_public: boolean;
  created_at: string;
}

interface PostRow {
  id: string;
  author_id: string;
  type: PostType;
  body: string | null;
  image_url: string | null;
  recipe_id: string | null;
  hidden: boolean;
  created_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  hidden: boolean;
  created_at: string;
}

interface AuthorRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_pro: boolean;
}

type Tally = { score: number; myVote: -1 | 0 | 1 };

function toRecipe(row: RecipeRow): CommunityRecipe {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    cuisine: row.cuisine,
    dietTags: row.diet_tags ?? [],
    isPublic: row.is_public,
    createdAt: row.created_at,
  };
}

function unknownAuthor(userId: string): AuthorSummary {
  return { userId, username: 'unknown', displayName: 'A cook', avatarUrl: null, isPro: false };
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
/* Shared lookups: authors, vote tallies, blocks                      */
/* ------------------------------------------------------------------ */

async function getAuthors(ids: string[]): Promise<Map<string, AuthorSummary>> {
  const unique = Array.from(new Set(ids));
  const map = new Map<string, AuthorSummary>();
  if (unique.length === 0) return map;
  const { data } = await supabase.from('profiles').select('user_id, username, display_name, avatar_url, is_pro').in('user_id', unique);
  for (const r of (data ?? []) as AuthorRow[]) {
    map.set(r.user_id, { userId: r.user_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url, isPro: r.is_pro });
  }
  return map;
}

async function getVoteTallies(targetType: VoteTargetType, ids: string[]): Promise<Map<string, Tally>> {
  const map = new Map<string, Tally>();
  if (ids.length === 0) return map;
  for (const id of ids) map.set(id, { score: 0, myVote: 0 });
  const userId = await currentUserId();
  const { data } = await supabase.from('votes').select('target_id, value, user_id').eq('target_type', targetType).in('target_id', ids);
  for (const r of (data ?? []) as { target_id: string; value: 1 | -1; user_id: string }[]) {
    const entry = map.get(r.target_id);
    if (!entry) continue;
    entry.score += r.value;
    if (userId && r.user_id === userId) entry.myVote = r.value;
  }
  return map;
}

/** Posts/comments by users the signed-in viewer has blocked. Empty when signed out. */
export async function getBlockedIds(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', userId);
  return (data ?? []).map((r) => (r as { blocked_id: string }).blocked_id);
}

export async function blockUser(targetUserId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId || userId === targetUserId) return;
  await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: targetUserId });
}

export async function unblockUser(targetUserId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', targetUserId);
}

/* ------------------------------------------------------------------ */
/* Feed + posts                                                       */
/* ------------------------------------------------------------------ */

const FEED_FETCH_LIMIT = 200;
const FEED_PAGE_SIZE = 50;

/** Reddit-style decay: net score divided by (age in hours + 2) ^ 1.5. */
function hotScore(score: number, createdAt: string): number {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  return score / Math.pow(ageHours + 2, 1.5);
}

async function getCommentCounts(postIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (postIds.length === 0) return map;
  const { data } = await supabase.from('comments').select('post_id').in('post_id', postIds);
  for (const r of (data ?? []) as { post_id: string }[]) map.set(r.post_id, (map.get(r.post_id) ?? 0) + 1);
  return map;
}

async function getRecipeTitles(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return map;
  const { data } = await supabase.from('recipes').select('id, title').in('id', unique);
  for (const r of (data ?? []) as { id: string; title: string }[]) map.set(r.id, r.title);
  return map;
}

async function toPosts(rows: PostRow[]): Promise<Post[]> {
  if (rows.length === 0) return [];
  const recipeIds = rows.map((r) => r.recipe_id).filter((id): id is string => Boolean(id));
  const [authors, tallies, commentCounts, recipeTitles] = await Promise.all([
    getAuthors(rows.map((r) => r.author_id)),
    getVoteTallies('post', rows.map((r) => r.id)),
    getCommentCounts(rows.map((r) => r.id)),
    getRecipeTitles(recipeIds),
  ]);

  return rows.map((r) => {
    const tally = tallies.get(r.id) ?? { score: 0, myVote: 0 as const };
    return {
      id: r.id,
      author: authors.get(r.author_id) ?? unknownAuthor(r.author_id),
      type: r.type,
      body: r.body,
      imageUrl: r.image_url,
      recipeId: r.recipe_id,
      recipeTitle: r.recipe_id ? recipeTitles.get(r.recipe_id) ?? null : null,
      score: tally.score,
      myVote: tally.myVote,
      commentCount: commentCounts.get(r.id) ?? 0,
      createdAt: r.created_at,
    };
  });
}

/**
 * Ranked feed for one of the four sorts. 'following' returns [] when signed
 * out or following no one. Hot/Top are computed client-side over the most
 * recent FEED_FETCH_LIMIT posts — fine at this scale, same tradeoff the
 * leaderboard already makes in social.ts's rankProfiles.
 */
export async function getFeed(sort: FeedSort): Promise<Post[]> {
  const userId = await currentUserId();
  const blocked = await getBlockedIds();

  let query = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(FEED_FETCH_LIMIT);

  if (sort === 'following') {
    if (!userId) return [];
    const { data: followingRows } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
    const ids = (followingRows ?? []).map((r) => (r as { following_id: string }).following_id);
    if (ids.length === 0) return [];
    query = query.in('author_id', ids);
  }

  const { data } = await query;
  let rows = (data ?? []) as PostRow[];
  if (blocked.length > 0) rows = rows.filter((r) => !blocked.includes(r.author_id));

  const posts = await toPosts(rows);

  if (sort === 'top') posts.sort((a, b) => b.score - a.score);
  else if (sort === 'hot') posts.sort((a, b) => hotScore(b.score, b.createdAt) - hotScore(a.score, a.createdAt));
  // 'new' and 'following' stay created_at desc, as fetched.

  return posts.slice(0, FEED_PAGE_SIZE);
}

/** A single author's posts, newest first — backs a profile's "Posts" tab. */
export async function getPostsByAuthor(authorId: string, limit = 30): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return toPosts((data ?? []) as PostRow[]);
}

export async function getPost(id: string): Promise<Post | null> {
  const { data } = await supabase.from('posts').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const [post] = await toPosts([data as PostRow]);
  return post ?? null;
}

export async function createPost(input: {
  type: PostType;
  body?: string | null;
  imageUrl?: string | null;
  recipeId?: string | null;
}): Promise<{ post?: Post; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'Sign in first.' };
  const mod = moderateText(input.body, { min: input.type === 'text' ? 2 : 0 });
  if (!mod.ok) return { error: mod.reason };
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: userId,
      type: input.type,
      body: input.body?.trim() || null,
      image_url: input.imageUrl ?? null,
      recipe_id: input.recipeId ?? null,
    })
    .select('*')
    .maybeSingle();
  if (error) return { error: /row-level security/i.test(error.message) ? 'Make your profile public to post.' : error.message };
  if (!data) return { error: 'Could not create post.' };
  const [post] = await toPosts([data as PostRow]);
  return { post };
}

export async function deletePost(id: string): Promise<void> {
  await supabase.from('posts').delete().eq('id', id);
}

/* ------------------------------------------------------------------ */
/* Comments (one level of threading, like the M3 plan)                */
/* ------------------------------------------------------------------ */

function toCommentNode(row: CommentRow, author: AuthorSummary, tally: Tally): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    author,
    parentCommentId: row.parent_comment_id,
    body: row.body,
    score: tally.score,
    myVote: tally.myVote,
    createdAt: row.created_at,
    replies: [],
  };
}

export async function getComments(postId: string): Promise<Comment[]> {
  const { data } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
  const rows = (data ?? []) as CommentRow[];
  if (rows.length === 0) return [];

  const [authors, tallies] = await Promise.all([
    getAuthors(rows.map((r) => r.author_id)),
    getVoteTallies('comment', rows.map((r) => r.id)),
  ]);

  const byId = new Map<string, Comment>();
  for (const r of rows) {
    byId.set(r.id, toCommentNode(r, authors.get(r.author_id) ?? unknownAuthor(r.author_id), tallies.get(r.id) ?? { score: 0, myVote: 0 }));
  }

  const roots: Comment[] = [];
  for (const r of rows) {
    const node = byId.get(r.id);
    if (!node) continue;
    const parent = r.parent_comment_id ? byId.get(r.parent_comment_id) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function addComment(input: { postId: string; parentCommentId?: string | null; body: string }): Promise<{ comment?: Comment; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'Sign in first.' };
  const body = input.body.trim();
  if (!body) return { error: 'Write something first.' };
  const mod = moderateText(body);
  if (!mod.ok) return { error: mod.reason };

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: input.postId, author_id: userId, parent_comment_id: input.parentCommentId ?? null, body })
    .select('*')
    .maybeSingle();
  if (error) return { error: /row-level security/i.test(error.message) ? 'Make your profile public to comment.' : error.message };
  if (!data) return { error: 'Could not post comment.' };

  const author = (await getAuthors([userId])).get(userId) ?? unknownAuthor(userId);
  return { comment: toCommentNode(data as CommentRow, author, { score: 0, myVote: 0 }) };
}

/* ------------------------------------------------------------------ */
/* Voting (toggle: voting the same value again clears it)             */
/* ------------------------------------------------------------------ */

export async function vote(targetType: VoteTargetType, targetId: string, value: 1 | -1): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { data: existing } = await supabase
    .from('votes')
    .select('value')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();
  const current = (existing as { value: 1 | -1 } | null)?.value;
  if (current === value) {
    await supabase.from('votes').delete().eq('user_id', userId).eq('target_type', targetType).eq('target_id', targetId);
  } else {
    await supabase
      .from('votes')
      .upsert({ user_id: userId, target_type: targetType, target_id: targetId, value }, { onConflict: 'user_id,target_type,target_id' });
  }
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export async function reportContent(targetType: VoteTargetType, targetId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Sign in first.' };
  const { error } = await supabase.from('reports').insert({ reporter_id: userId, target_type: targetType, target_id: targetId, reason: reason ?? null });
  if (error) {
    return { ok: false, error: /duplicate key|unique/i.test(error.message) ? 'You already reported this.' : error.message };
  }
  return { ok: true };
}

export async function hasReported(targetType: VoteTargetType, targetId: string): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  const { data } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();
  return Boolean(data);
}

/* ------------------------------------------------------------------ */
/* Recipes                                                             */
/* ------------------------------------------------------------------ */

export async function createRecipe(input: {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  ingredients: string[];
  steps: string[];
  cuisine?: string | null;
  dietTags?: string[];
}): Promise<{ recipe?: CommunityRecipe; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'Sign in first.' };

  const title = input.title.trim();
  const ingredients = input.ingredients.map((i) => i.trim()).filter(Boolean);
  const steps = input.steps.map((s) => s.trim()).filter(Boolean);
  if (!title) return { error: 'Give the recipe a title.' };
  if (ingredients.length === 0 || steps.length === 0) return { error: 'Add at least one ingredient and one step.' };
  for (const text of [title, input.description ?? '', ...ingredients, ...steps]) {
    const mod = moderateText(text);
    if (!mod.ok) return { error: mod.reason };
  }

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      author_id: userId,
      title,
      description: input.description?.trim() || null,
      image_url: input.imageUrl ?? null,
      ingredients,
      steps,
      cuisine: input.cuisine ?? null,
      diet_tags: input.dietTags ?? [],
      is_public: true,
    })
    .select('*')
    .maybeSingle();
  if (error) return { error: error.message };
  return data ? { recipe: toRecipe(data as RecipeRow) } : { error: 'Could not save recipe.' };
}

export async function getRecipe(id: string): Promise<CommunityRecipe | null> {
  const { data } = await supabase.from('recipes').select('*').eq('id', id).maybeSingle();
  return data ? toRecipe(data as RecipeRow) : null;
}

/* ------------------------------------------------------------------ */
/* Daily post/upload rate limit (client-side gate, mirrors             */
/* src/lib/subscription.ts's weekly plan-generation counter)          */
/* ------------------------------------------------------------------ */

export const FREE_DAILY_POSTS = 5;
export const PRO_DAILY_POSTS = 30;

const POSTS_KEY = 'mealmesh.posts';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function postsToday(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(POSTS_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { day: string; count: number };
    return parsed.day === todayIso() ? parsed.count : 0;
  } catch {
    return 0;
  }
}

export async function bumpPosts(): Promise<number> {
  const count = (await postsToday()) + 1;
  await AsyncStorage.setItem(POSTS_KEY, JSON.stringify({ day: todayIso(), count })).catch(() => {});
  return count;
}
