/**
 * Community recipe detail. "Cook this" logs it against today's plan slot
 * (closing the gamification loop — see src/lib/gamification.ts); "Share"
 * reposts it to the signed-in user's own feed. Free-text content: never run
 * through the engine's validatePlan safety pass, unlike a generated plan.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Button, Chip, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { createPost, getRecipe } from '@/lib/community';
import { getMyProfile, logMeal } from '@/lib/social';
import { currentWeekStart } from '@/lib/store';
import { usePalette } from '@/theme/use-theme';
import { MEAL_SLOTS, type CommunityRecipe, type DayOfWeek, type MealSlot } from '@/types';

const JS_DAY_ORDER: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', supper: 'Supper', dinner: 'Dinner' };

function todayDayOfWeek(): DayOfWeek {
  return JS_DAY_ORDER[new Date().getDay()];
}

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { session } = useAuth();

  const [recipe, setRecipe] = useState<CommunityRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [canPost, setCanPost] = useState(false);
  const [slot, setSlot] = useState<MealSlot | null>(null);
  const [cookMsg, setCookMsg] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void getRecipe(String(id ?? '')).then((r) => {
      setRecipe(r);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!session) {
      setCanPost(false);
      return;
    }
    void getMyProfile().then((p) => setCanPost(Boolean(p?.isPublic)));
  }, [session]);

  const cook = async (chosenSlot: MealSlot) => {
    if (!recipe) return;
    setSlot(chosenSlot);
    await logMeal({ weekStart: currentWeekStart(), dayOfWeek: todayDayOfWeek(), slot: chosenSlot, mealName: recipe.title });
    setCookMsg(`Logged as today's ${SLOT_LABEL[chosenSlot].toLowerCase()} — +10 points!`);
  };

  const share = async () => {
    if (!recipe) return;
    setSharing(true);
    const res = await createPost({ type: 'recipe', recipeId: recipe.id });
    setSharing(false);
    setShareMsg(res.post ? 'Shared to your feed.' : res.error ?? 'Could not share.');
  };

  return (
    <Screen art={Art.steak} wide>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <Heading>Recipe</Heading>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : !recipe ? (
        <View style={styles.center}>
          <Body style={{ textAlign: 'center' }}>This recipe isn&apos;t available.</Body>
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
          <Reveal>
            <GlassCard style={{ gap: Spacing.three }}>
              {recipe.imageUrl && <Image source={{ uri: recipe.imageUrl }} resizeMode="cover" style={styles.hero} />}
              <Heading>{recipe.title}</Heading>
              {recipe.description && <Body color={palette.textSecondary}>{recipe.description}</Body>}
              {(recipe.cuisine || recipe.dietTags.length > 0) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                  {recipe.cuisine && <Chip label={recipe.cuisine} selected={false} onPress={() => {}} />}
                  {recipe.dietTags.map((t) => (
                    <Chip key={t} label={t} selected={false} onPress={() => {}} />
                  ))}
                </View>
              )}
              <Small color={palette.textSecondary}>
                Community recipe — not checked against any household&apos;s dietary restrictions.
              </Small>
            </GlassCard>
          </Reveal>

          <Reveal delay={60}>
            <View style={{ gap: Spacing.two }}>
              <Eyebrow>Ingredients</Eyebrow>
              <GlassCard style={{ gap: Spacing.two }}>
                {recipe.ingredients.map((ing, i) => (
                  <Body key={i}>• {ing}</Body>
                ))}
              </GlassCard>
            </View>
          </Reveal>

          <Reveal delay={100}>
            <View style={{ gap: Spacing.two }}>
              <Eyebrow>Method</Eyebrow>
              <GlassCard style={{ gap: Spacing.three }}>
                {recipe.steps.map((step, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: Spacing.two }}>
                    <Text style={{ fontFamily: Type.displayBold, fontSize: 15, color: palette.accent, width: 22 }}>{i + 1}.</Text>
                    <Body style={{ flex: 1 }}>{step}</Body>
                  </View>
                ))}
              </GlassCard>
            </View>
          </Reveal>

          <Reveal delay={140}>
            <GlassCard style={{ gap: Spacing.three }}>
              <Eyebrow>Cook this</Eyebrow>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                {MEAL_SLOTS.map((s) => (
                  <Chip key={s} label={SLOT_LABEL[s]} selected={slot === s} onPress={() => cook(s)} />
                ))}
              </View>
              {cookMsg && <Small color={palette.accent}>{cookMsg}</Small>}

              {canPost && (
                <>
                  <Button title={sharing ? 'Sharing…' : 'Share to your feed'} variant="secondary" disabled={sharing} onPress={share} />
                  {shareMsg && <Small color={palette.textSecondary}>{shareMsg}</Small>}
                </>
              )}
            </GlassCard>
          </Reveal>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  hero: { width: '100%', height: 200, borderRadius: 14 },
});
