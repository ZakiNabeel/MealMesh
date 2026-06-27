/**
 * Post detail — full post, threaded comments, voting, report/block.
 * Commenting requires a public profile, same gate as creating a post
 * (src/lib/community.ts) so every author's name/avatar can resolve for
 * everyone else reading the thread.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Art } from '@/components/art';
import { Avatar, Body, Button, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { addComment, blockUser, deletePost, getComments, getPost, hasReported, reportContent, vote } from '@/lib/community';
import { getMyProfile } from '@/lib/social';
import { usePalette } from '@/theme/use-theme';
import type { Comment, Post } from '@/types';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { session } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [canPost, setCanPost] = useState(false);
  const [reported, setReported] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([getPost(String(id ?? '')), getComments(String(id ?? ''))]);
    setPost(p);
    setComments(c);
    setLoading(false);
    if (p) setReported(await hasReported('post', p.id));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session) {
      setCanPost(false);
      return;
    }
    void getMyProfile().then((p) => setCanPost(Boolean(p?.isPublic)));
  }, [session]);

  const isMine = session?.user.id === post?.author.userId;

  return (
    <Screen art={Art.rice} wide>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <Heading>Post</Heading>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : !post ? (
        <View style={styles.center}>
          <Body style={{ textAlign: 'center' }}>This post isn&apos;t available.</Body>
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
          <Reveal>
            <GlassCard style={{ gap: Spacing.three }}>
              <PressableScale onPress={() => router.push({ pathname: '/u/[username]', params: { username: post.author.username } })} to={0.99}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                  <Avatar name={post.author.displayName || post.author.username} uri={post.author.avatarUrl} size={36} />
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontFamily: Type.bodySemibold }}>{post.author.displayName || post.author.username}</Body>
                    <Small color={palette.textSecondary}>@{post.author.username} · {timeAgo(post.createdAt)}</Small>
                  </View>
                  {post.author.isPro && <Text style={{ fontFamily: Type.bodySemibold, fontSize: 11, color: palette.accent }}>PRO ✦</Text>}
                </View>
              </PressableScale>

              {post.type === 'recipe' && post.recipeId && post.recipeTitle && (
                <PressableScale onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: post.recipeId! } })} to={0.98}>
                  <View style={[styles.recipeChip, { borderColor: palette.border, backgroundColor: palette.backgroundElement }]}>
                    <Small color={palette.text} style={{ fontFamily: Type.bodySemibold }}>📖 {post.recipeTitle} — view recipe ›</Small>
                  </View>
                </PressableScale>
              )}

              {post.body && <Body>{post.body}</Body>}
              {post.imageUrl && <Image source={{ uri: post.imageUrl }} resizeMode="cover" style={styles.postImage} />}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                <VoteControl score={post.score} myVote={post.myVote} onVote={(v) => vote('post', post.id, v)} />
                {isMine ? (
                  <PressableScale
                    onPress={async () => {
                      await deletePost(post.id);
                      router.back();
                    }}
                    to={0.95}
                  >
                    <Small color={palette.danger}>Delete</Small>
                  </PressableScale>
                ) : (
                  session && (
                    <>
                      <PressableScale
                        onPress={async () => {
                          if (reported) return;
                          const res = await reportContent('post', post.id);
                          if (res.ok) setReported(true);
                        }}
                        to={0.95}
                      >
                        <Small color={palette.textSecondary}>{reported ? 'Reported' : 'Report'}</Small>
                      </PressableScale>
                      <PressableScale
                        onPress={async () => {
                          await blockUser(post.author.userId);
                          router.back();
                        }}
                        to={0.95}
                      >
                        <Small color={palette.textSecondary}>Block</Small>
                      </PressableScale>
                    </>
                  )
                )}
              </View>
            </GlassCard>
          </Reveal>

          <Reveal delay={60}>
            <View style={{ gap: Spacing.three }}>
              <Body style={{ fontFamily: Type.bodySemibold }}>{comments.length === 0 ? 'No comments yet' : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}</Body>

              {session && canPost && (
                <CommentComposer
                  onSubmit={async (body) => {
                    const res = await addComment({ postId: post.id, body });
                    if (res.comment) setComments((cs) => [...cs, res.comment!]);
                  }}
                />
              )}
              {session && !canPost && (
                <Small color={palette.textSecondary}>Make your profile public (Settings → Profile) to comment.</Small>
              )}

              {comments.map((c) => (
                <CommentNode key={c.id} comment={c} postId={post.id} canReply={canPost} onReplied={(reply) => attachReply(setComments, c.id, reply)} />
              ))}
            </View>
          </Reveal>
        </ScrollView>
      )}
    </Screen>
  );
}

/** Insert a reply under its parent without a full reload. */
function attachReply(setComments: (fn: (cs: Comment[]) => Comment[]) => void, parentId: string, reply: Comment) {
  const insert = (nodes: Comment[]): Comment[] =>
    nodes.map((n) => (n.id === parentId ? { ...n, replies: [...n.replies, reply] } : { ...n, replies: insert(n.replies) }));
  setComments(insert);
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function VoteControl({ score, myVote, onVote }: { score: number; myVote: -1 | 0 | 1; onVote: (v: 1 | -1) => void }) {
  const palette = usePalette();
  const [localScore, setLocalScore] = useState(score);
  const [localVote, setLocalVote] = useState(myVote);

  const cast = (value: 1 | -1) => {
    const next = localVote === value ? 0 : value;
    setLocalScore(localScore - localVote + next);
    setLocalVote(next);
    onVote(value);
  };

  return (
    <View style={[styles.voteRow, { borderColor: palette.border }]}>
      <PressableScale onPress={() => cast(1)} to={0.9}>
        <Text style={{ fontSize: 16, color: localVote === 1 ? palette.accent : palette.textSecondary }}>▲</Text>
      </PressableScale>
      <Text style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.text, minWidth: 20, textAlign: 'center' }}>{localScore}</Text>
      <PressableScale onPress={() => cast(-1)} to={0.9}>
        <Text style={{ fontSize: 16, color: localVote === -1 ? palette.blue : palette.textSecondary }}>▼</Text>
      </PressableScale>
    </View>
  );
}

function CommentComposer({ onSubmit }: { onSubmit: (body: string) => Promise<void> }) {
  const palette = usePalette();
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <View style={{ gap: Spacing.two }}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Add a comment…"
        placeholderTextColor={palette.textSecondary}
        multiline
        style={[styles.commentInput, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]}
      />
      <Button
        title={saving ? 'Posting…' : 'Comment'}
        variant="secondary"
        disabled={saving || !body.trim()}
        onPress={async () => {
          setSaving(true);
          await onSubmit(body);
          setBody('');
          setSaving(false);
        }}
      />
    </View>
  );
}

function CommentNode({
  comment,
  postId,
  canReply,
  depth = 0,
  onReplied,
}: {
  comment: Comment;
  postId: string;
  canReply: boolean;
  depth?: number;
  onReplied: (reply: Comment) => void;
}) {
  const palette = usePalette();
  const [replying, setReplying] = useState(false);

  return (
    <View style={{ gap: Spacing.two, marginLeft: depth * 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <Avatar name={comment.author.displayName || comment.author.username} uri={comment.author.avatarUrl} size={22} />
        <Small color={palette.text} style={{ fontFamily: Type.bodySemibold }}>{comment.author.displayName || comment.author.username}</Small>
        <Small color={palette.textSecondary}>· {timeAgo(comment.createdAt)}</Small>
      </View>
      <Body style={{ marginLeft: 30 }}>{comment.body}</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginLeft: 30 }}>
        <VoteControl score={comment.score} myVote={comment.myVote} onVote={(v) => vote('comment', comment.id, v)} />
        {canReply && (
          <PressableScale onPress={() => setReplying((r) => !r)} to={0.95}>
            <Small color={palette.textSecondary}>Reply</Small>
          </PressableScale>
        )}
      </View>

      {replying && (
        <View style={{ marginLeft: 30 }}>
          <CommentComposer
            onSubmit={async (body) => {
              const res = await addComment({ postId, parentCommentId: comment.id, body });
              if (res.comment) {
                onReplied(res.comment);
                setReplying(false);
              }
            }}
          />
        </View>
      )}

      {comment.replies.map((r) => (
        <CommentNode key={r.id} comment={r} postId={postId} canReply={canReply} depth={depth + 1} onReplied={onReplied} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  postImage: { width: '100%', height: 220, borderRadius: 14 },
  recipeChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  commentInput: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, minHeight: 44, fontFamily: Type.body, fontSize: 14 },
});
