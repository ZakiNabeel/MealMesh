/**
 * Composer for the three post types: text, photo, recipe. Gated on a public
 * profile (same reason as commenting — see src/lib/community.ts) and a daily
 * post cap (Free vs Pro, mirrors the weekly plan-generation gate).
 */

import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Button, Chip, Eyebrow, GlassCard, Heading, PressableScale, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { bumpPosts, createPost, createRecipe, FREE_DAILY_POSTS, PRO_DAILY_POSTS, postsToday } from '@/lib/community';
import { pickAndUploadImage } from '@/lib/imageUpload';
import { getMyProfile } from '@/lib/social';
import { useSubscription } from '@/lib/subscription';
import { usePalette } from '@/theme/use-theme';
import type { PostType } from '@/types';

const TYPES: { key: PostType; label: string }[] = [
  { key: 'text', label: 'Text' },
  { key: 'photo', label: 'Photo' },
  { key: 'recipe', label: 'Recipe' },
];

export default function ComposeScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { session } = useAuth();
  const { isPro } = useSubscription();

  const [canPost, setCanPost] = useState<boolean | null>(null);
  const [type, setType] = useState<PostType>('text');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);

  useEffect(() => {
    if (!session) {
      router.replace('/auth');
      return;
    }
    void getMyProfile().then((p) => setCanPost(Boolean(p?.isPublic)));
    void postsToday().then((n) => setCapped(n >= (isPro ? PRO_DAILY_POSTS : FREE_DAILY_POSTS)));
  }, [session, isPro, router]);

  const addPhoto = async () => {
    setUploading(true);
    setError(null);
    const res = await pickAndUploadImage('post-images');
    setUploading(false);
    if ('url' in res) setImageUrl(res.url);
    else if ('error' in res) setError(res.error);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);

    if (type === 'recipe') {
      const recipeRes = await createRecipe({
        title,
        description: description || null,
        imageUrl,
        ingredients: ingredients.split('\n'),
        steps: steps.split('\n'),
      });
      if (recipeRes.error || !recipeRes.recipe) {
        setError(recipeRes.error ?? 'Could not save recipe.');
        setSaving(false);
        return;
      }
      const postRes = await createPost({ type: 'recipe', recipeId: recipeRes.recipe.id });
      if (postRes.error || !postRes.post) {
        setError(postRes.error ?? 'Could not share recipe.');
        setSaving(false);
        return;
      }
      await bumpPosts();
      router.replace({ pathname: '/post/[id]', params: { id: postRes.post.id } });
      return;
    }

    if (type === 'photo' && !imageUrl) {
      setError('Add a photo first.');
      setSaving(false);
      return;
    }

    const res = await createPost({ type, body: body || null, imageUrl: type === 'photo' ? imageUrl : null });
    setSaving(false);
    if (res.error || !res.post) {
      setError(res.error ?? 'Could not post.');
      return;
    }
    await bumpPosts();
    router.replace({ pathname: '/post/[id]', params: { id: res.post.id } });
  };

  const canSubmit =
    !saving &&
    !capped &&
    canPost === true &&
    (type === 'text' ? body.trim().length > 0 : type === 'photo' ? Boolean(imageUrl) : title.trim().length > 0 && ingredients.trim().length > 0 && steps.trim().length > 0);

  return (
    <Screen art={Art.cinnamon}>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <Heading>New post</Heading>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
        {canPost === false && (
          <GlassCard style={{ gap: Spacing.two }}>
            <Small color={palette.textSecondary}>Make your profile public before posting — others need to see who shared it.</Small>
            <Button title="Go to profile" variant="secondary" onPress={() => router.push('/profile')} />
          </GlassCard>
        )}

        {capped && (
          <GlassCard>
            <Small color={palette.textSecondary}>
              You&apos;ve hit today&apos;s posting limit ({isPro ? PRO_DAILY_POSTS : FREE_DAILY_POSTS}/day). Come back tomorrow{isPro ? '' : ', or go Pro for a higher limit'}.
            </Small>
          </GlassCard>
        )}

        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          {TYPES.map((t) => (
            <Chip key={t.key} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />
          ))}
        </View>

        {type === 'text' && (
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What's cooking?"
            placeholderTextColor={palette.textSecondary}
            multiline
            style={[styles.textArea, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]}
          />
        )}

        {type === 'photo' && (
          <View style={{ gap: Spacing.three }}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} resizeMode="cover" style={styles.photo} />
            ) : (
              <PressableScale onPress={addPhoto} to={0.98} disabled={uploading}>
                <View style={[styles.photoDrop, { borderColor: palette.border, backgroundColor: palette.backgroundElement }]}>
                  {uploading ? <ActivityIndicator color={palette.accent} /> : <Small color={palette.textSecondary}>📸 Add a photo</Small>}
                </View>
              </PressableScale>
            )}
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Caption (optional)"
              placeholderTextColor={palette.textSecondary}
              style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]}
            />
          </View>
        )}

        {type === 'recipe' && (
          <View style={{ gap: Spacing.three }}>
            <Small color={palette.textSecondary}>
              Community recipes are free-text — they aren&apos;t checked against any household&apos;s dietary restrictions.
            </Small>
            <Field label="Title">
              <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Weeknight chickpea curry" placeholderTextColor={palette.textSecondary} style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]} />
            </Field>
            <Field label="Description (optional)">
              <TextInput value={description} onChangeText={setDescription} placeholder="A short intro" placeholderTextColor={palette.textSecondary} style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]} />
            </Field>
            <Field label="Ingredients (one per line)">
              <TextInput value={ingredients} onChangeText={setIngredients} multiline placeholder={'2 cups chickpeas\n1 onion\n...'} placeholderTextColor={palette.textSecondary} style={[styles.textArea, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]} />
            </Field>
            <Field label="Steps (one per line)">
              <TextInput value={steps} onChangeText={setSteps} multiline placeholder={'Chop the onion\nSauté until soft\n...'} placeholderTextColor={palette.textSecondary} style={[styles.textArea, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]} />
            </Field>
          </View>
        )}

        {error && <Small color={palette.danger}>{error}</Small>}

        <Button title={saving ? 'Posting…' : 'Post'} disabled={!canSubmit} onPress={submit} />
      </ScrollView>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 44, fontFamily: Type.body, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, minHeight: 100, fontFamily: Type.body, fontSize: 14 },
  photo: { width: '100%', height: 200, borderRadius: Radius.md },
  photoDrop: { width: '100%', height: 140, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
