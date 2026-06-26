/**
 * WebsiteLanding — the desktop (web, >=960px) marketing site for MealMesh.
 *
 * This is deliberately NOT the app shell: it's a full, sectioned website —
 * nav, hero with a product preview, how-it-works, the constraint-engine value
 * props, a featured-articles strip, a call-to-action band, and a footer with
 * social links. The phone experience stays the focused app (see app/index).
 */

import { useRouter } from 'expo-router';
import { useRef, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { FoodImage } from '@/components/FoodImage';
import { BrandLockup, SocialBar } from '@/components/SocialBar';
import { Atmosphere } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/theme/use-theme';

const MAXW = 1180;

const isHovered = (s: PressableStateCallbackType) => Boolean((s as { hovered?: boolean }).hovered);

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Center({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: '100%', maxWidth: MAXW, alignSelf: 'center', paddingHorizontal: 40 }, style]}>{children}</View>;
}

function CTA({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
}) {
  const palette = usePalette();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={(s) => [
        styles.cta,
        primary
          ? { backgroundColor: palette.accent }
          : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: palette.border },
        isHovered(s) && { opacity: 0.9, transform: [{ translateY: -1 }] },
      ]}
    >
      <Text style={{ fontFamily: Type.bodySemibold, fontSize: 15.5, color: primary ? palette.onAccent : palette.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

function NavLink({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} style={(s) => [styles.navLink, isHovered(s) && { opacity: 0.6 }]}>
      <Text style={{ fontFamily: Type.bodyMedium, fontSize: 15, color: palette.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function WebsiteLanding() {
  const palette = usePalette();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const anchors = useRef<Record<string, number>>({});

  const onAnchor = (key: string) => (e: LayoutChangeEvent) => {
    anchors.current[key] = e.nativeEvent.layout.y;
  };
  const goTo = (key: string) => scrollRef.current?.scrollTo({ y: Math.max(0, (anchors.current[key] ?? 0) - 24), animated: true });

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Atmosphere />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator style={{ flex: 1 }}>
        {/* NAV */}
        <Center style={styles.nav}>
          <BrandLockup palette={palette} size={36} />
          <View style={styles.navRight}>
            <NavLink label="How it works" onPress={() => goTo('how')} />
            <NavLink label="Why MealMesh" onPress={() => goTo('why')} />
            <NavLink label="Articles" onPress={() => goTo('articles')} />
            <NavLink label="Pricing" onPress={() => router.push('/paywall')} />
            <View style={{ width: 8 }} />
            <CTA label="Sign in" variant="ghost" onPress={() => router.push('/auth')} />
            <CTA label="Build our plan" onPress={() => router.push('/onboarding')} />
          </View>
        </Center>

        {/* HERO */}
        <Center style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>MEAL PLANNING FOR REAL HOUSEHOLDS</Text>
            <Text style={[styles.h1, { color: palette.text }]}>
              One household.{'\n'}Many diets.{'\n'}
              <Text style={{ color: palette.accent }}>One plan.</Text>
            </Text>
            <Text style={[styles.lead, { color: palette.textSecondary }]}>
              Halal, gluten-free, diabetic, vegan, a picky kid — MealMesh merges every diet at your table into a single
              weekly plan, and one grocery list to match. No cooking three different dinners.
            </Text>
            <View style={styles.heroCtas}>
              <CTA label="Build our plan — free" onPress={() => router.push('/onboarding')} />
              <CTA label="See how it works" variant="ghost" onPress={() => goTo('how')} />
            </View>
            <Text style={[styles.trust, { color: palette.textSecondary }]}>
              No card to start · Works on phone & laptop · Your diets stay private
            </Text>
          </View>

          <View style={styles.heroRight}>
            <PlanPreview />
          </View>
        </Center>

        {/* HOW IT WORKS */}
        <View onLayout={onAnchor('how')}>
          <Center style={styles.section}>
            <SectionHead kicker="HOW IT WORKS" title="Three steps to one plan everyone can eat" />
            <View style={styles.cards3}>
              {STEPS.map((s, i) => (
                <View key={s.title} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <View style={[styles.stepNum, { backgroundColor: palette.accentMuted }]}>
                    <Text style={{ fontFamily: Type.displayBold, fontSize: 18, color: palette.accent }}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{s.title}</Text>
                  <Text style={[styles.cardBody, { color: palette.textSecondary }]}>{s.body}</Text>
                </View>
              ))}
            </View>
          </Center>
        </View>

        {/* WHY MEALMESH */}
        <View onLayout={onAnchor('why')} style={{ backgroundColor: palette.backgroundElement }}>
          <Center style={styles.section}>
            <SectionHead kicker="THE DIFFERENCE" title="Built for safety, not guesswork" />
            <View style={styles.cards3}>
              {VALUES.map((v) => (
                <View key={v.title} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={{ fontSize: 26, marginBottom: 6 }}>{v.icon}</Text>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{v.title}</Text>
                  <Text style={[styles.cardBody, { color: palette.textSecondary }]}>{v.body}</Text>
                </View>
              ))}
            </View>
          </Center>
        </View>

        {/* ARTICLES */}
        <View onLayout={onAnchor('articles')}>
          <Center style={styles.section}>
            <SectionHead kicker="FROM THE KITCHEN" title="Guides for multi-diet households" />
            <View style={styles.cards3}>
              {ARTICLES.map((a) => (
                <Pressable
                  key={a.title}
                  style={(s) => [
                    styles.article,
                    { backgroundColor: palette.card, borderColor: palette.border },
                    isHovered(s) && { transform: [{ translateY: -3 }], borderColor: palette.accent },
                  ]}
                >
                  <FoodImage name={a.query} ingredients={[]} query={a.query} style={styles.articleImg} radius={0} emojiSize={40} />
                  <View style={{ padding: Spacing.three, gap: 6 }}>
                    <View style={styles.articleMeta}>
                      <Text style={[styles.eyebrow, { color: palette.accent, fontSize: 11 }]}>{a.category}</Text>
                      <View style={[styles.soonPill, { backgroundColor: palette.backgroundElement }]}>
                        <Text style={{ fontFamily: Type.bodyMedium, fontSize: 10.5, color: palette.textSecondary }}>Coming soon</Text>
                      </View>
                    </View>
                    <Text style={[styles.articleTitle, { color: palette.text }]}>{a.title}</Text>
                    <Text style={[styles.cardBody, { color: palette.textSecondary }]} numberOfLines={2}>
                      {a.excerpt}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </Center>
        </View>

        {/* CTA BAND */}
        <Center style={{ paddingVertical: 24 }}>
          <View style={[styles.band, { backgroundColor: palette.accent }]}>
            <Text style={[styles.bandTitle, { color: palette.onAccent }]}>Ready to feed everyone at your table?</Text>
            <Text style={[styles.bandSub, { color: palette.onAccent }]}>
              Set up your household once. Get a fresh, safe plan every week.
            </Text>
            <Pressable
              onPress={() => router.push('/onboarding')}
              style={(s) => [styles.bandBtn, { backgroundColor: palette.onAccent }, isHovered(s) && { opacity: 0.92 }]}
            >
              <Text style={{ fontFamily: Type.bodySemibold, fontSize: 16, color: palette.accent }}>Build our plan — free</Text>
            </Pressable>
          </View>
        </Center>

        {/* FOOTER */}
        <View style={[styles.footer, { borderTopColor: palette.border }]}>
          <Center style={styles.footerInner}>
            <View style={styles.footerBrand}>
              <BrandLockup palette={palette} size={34} />
              <Text style={[styles.cardBody, { color: palette.textSecondary, maxWidth: 280 }]}>
                One household. Many diets. One plan. One grocery list.
              </Text>
              <SocialBar palette={palette} />
            </View>
            <View style={styles.footerCols}>
              <FooterCol title="Product" links={[['Build a plan', () => router.push('/onboarding')], ['Pricing', () => router.push('/paywall')], ['Cook from pantry', () => router.push('/pantry')]]} />
              <FooterCol title="Company" links={[['Articles', () => goTo('articles')], ['How it works', () => goTo('how')], ['Sign in', () => router.push('/auth')]]} />
            </View>
          </Center>
          <Center>
            <View style={[styles.footerBottom, { borderTopColor: palette.border }]}>
              <Text style={{ fontFamily: Type.body, fontSize: 13, color: palette.textSecondary }}>
                © {new Date().getFullYear()} MealMesh — made for households everywhere.
              </Text>
            </View>
          </Center>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components & content                                           */
/* ------------------------------------------------------------------ */

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  const palette = usePalette();
  return (
    <View style={{ alignItems: 'center', gap: 10, marginBottom: 36 }}>
      <Text style={[styles.eyebrow, { color: palette.accent }]}>{kicker}</Text>
      <Text style={[styles.h2, { color: palette.text }]}>{title}</Text>
    </View>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, () => void][] }) {
  const palette = usePalette();
  return (
    <View style={{ gap: 12, minWidth: 140 }}>
      <Text style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.text, letterSpacing: 0.4 }}>{title}</Text>
      {links.map(([label, onPress]) => (
        <Pressable key={label} onPress={onPress} style={(s) => [isHovered(s) && { opacity: 0.6 }]}>
          <Text style={{ fontFamily: Type.body, fontSize: 14, color: palette.textSecondary }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A realistic preview of a generated week — the product, not marketing chips. */
function PlanPreview() {
  const palette = usePalette();
  return (
    <View style={[styles.preview, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.previewTop}>
        <View>
          <Text style={{ fontFamily: Type.displayBold, fontSize: 17, color: palette.text }}>This week’s plan</Text>
          <Text style={{ fontFamily: Type.body, fontSize: 12.5, color: palette.textSecondary }}>The Khan family · 4 members</Text>
        </View>
        <View style={[styles.everyDiet, { backgroundColor: palette.accentMuted }]}>
          <Text style={{ fontFamily: Type.bodySemibold, fontSize: 12, color: palette.accent }}>Every diet ✓</Text>
        </View>
      </View>
      {PREVIEW_DAYS.map((d) => (
        <View key={d.day} style={[styles.previewRow, { borderTopColor: palette.border }]}>
          <FoodImage name={d.meal} ingredients={d.ing} query={d.query} style={styles.previewThumb} radius={Radius.sm} emojiSize={22} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 14, color: palette.text }}>{d.meal}</Text>
            <Text style={{ fontFamily: Type.body, fontSize: 12, color: palette.textSecondary }}>{d.note}</Text>
          </View>
          <Text style={{ fontFamily: Type.bodyMedium, fontSize: 12, color: palette.textSecondary }}>{d.day}</Text>
        </View>
      ))}
    </View>
  );
}

const STEPS = [
  { title: 'Add your household', body: 'Each person, each diet — halal, gluten-free, diabetic, allergies, the lot. Tap a few chips and you’re done.' },
  { title: 'We merge every diet', body: 'Our engine computes what’s safe for everyone, then asks Claude for real, culturally-aware dishes.' },
  { title: 'One plan, one list', body: 'Get a 7-day plan plus a single consolidated grocery list. Shared dishes where possible, simple swaps where needed.' },
];

const VALUES = [
  { icon: '🛡️', title: 'Safety-first engine', body: 'Allergens and religious rules are hard-enforced in code — a deterministic check, never left to the model alone.' },
  { icon: '🌍', title: 'Culturally aware', body: 'Halal, kosher, Jain, South-Asian, Mediterranean and more — real dishes with local names, not bland substitutes.' },
  { icon: '🛒', title: 'One grocery list', body: 'Every meal for every member, merged into a single checkable shopping list calibrated to your budget.' },
];

const ARTICLES = [
  {
    category: 'GUIDES',
    title: 'Feeding a halal + gluten-free home without cooking twice',
    excerpt: 'The shared-base method: one pot everyone eats from, with smart swaps for the constraints that differ.',
    query: 'biryani',
  },
  {
    category: 'NUTRITION',
    title: 'Diabetes-friendly dinners the whole family will actually eat',
    excerpt: 'Low-GI staples that don’t feel like “diet food,” balanced for kids and adults at the same table.',
    query: 'grilled chicken salad',
  },
  {
    category: 'BUDGET',
    title: 'Seven high-protein meals under your weekly budget',
    excerpt: 'How MealMesh calibrates prices to your region so the plan fits what groceries actually cost where you live.',
    query: 'lentil curry',
  },
];

const PREVIEW_DAYS = [
  { day: 'Mon', meal: 'Chicken karahi + roti', note: 'One shared dish · halal · feeds all 4', ing: ['chicken', 'tomato'], query: 'chicken karahi' },
  { day: 'Tue', meal: 'Daal & rice bowls', note: 'Vegan + gluten-free friendly', ing: ['lentils', 'rice'], query: 'daal rice' },
  { day: 'Wed', meal: 'Grilled fish, two ways', note: 'Simple swap for the low-carb member', ing: ['fish'], query: 'grilled fish plate' },
];

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 22, paddingBottom: 22 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLink: { paddingHorizontal: 8, paddingVertical: 6 },

  cta: { height: 46, paddingHorizontal: 20, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 56, paddingTop: 48, paddingBottom: 88 },
  heroLeft: { flex: 1.05, gap: 22 },
  heroRight: { flex: 0.95, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: Type.bodySemibold, fontSize: 12.5, letterSpacing: 1.8 },
  h1: { fontFamily: Type.displayBold, fontSize: 56, lineHeight: 60 },
  lead: { fontFamily: Type.body, fontSize: 18, lineHeight: 28, maxWidth: 520 },
  heroCtas: { flexDirection: 'row', gap: 12, marginTop: 4 },
  trust: { fontFamily: Type.body, fontSize: 13 },

  section: { paddingVertical: 80 },
  h2: { fontFamily: Type.displayBold, fontSize: 34, lineHeight: 40, textAlign: 'center', maxWidth: 640 },

  cards3: { flexDirection: 'row', gap: 24, alignItems: 'stretch' },
  card: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: 10 },
  stepNum: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cardTitle: { fontFamily: Type.displayBold, fontSize: 19, lineHeight: 24 },
  cardBody: { fontFamily: Type.body, fontSize: 14.5, lineHeight: 22 },

  article: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  articleImg: { width: '100%', height: 150 },
  articleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  soonPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  articleTitle: { fontFamily: Type.displayBold, fontSize: 16.5, lineHeight: 21 },

  band: { width: '100%', borderRadius: Radius.xl, paddingVertical: 56, paddingHorizontal: 40, alignItems: 'center', gap: 12 },
  bandTitle: { fontFamily: Type.displayBold, fontSize: 30, textAlign: 'center' },
  bandSub: { fontFamily: Type.body, fontSize: 16, textAlign: 'center', opacity: 0.92 },
  bandBtn: { height: 52, paddingHorizontal: 28, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 8 },

  footer: { borderTopWidth: 1, paddingTop: 56, paddingBottom: 28, marginTop: 24 },
  footerInner: { flexDirection: 'row', justifyContent: 'space-between', gap: 48, flexWrap: 'wrap' },
  footerBrand: { gap: 16, maxWidth: 320 },
  footerCols: { flexDirection: 'row', gap: 64 },
  footerBottom: { borderTopWidth: 1, marginTop: 40, paddingTop: 24 },

  preview: { width: '100%', maxWidth: 440, borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.four, gap: 4, shadowColor: '#0B2B26', shadowOpacity: 0.1, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } },
  previewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  everyDiet: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: 1 },
  previewThumb: { width: 52, height: 52 },
});
