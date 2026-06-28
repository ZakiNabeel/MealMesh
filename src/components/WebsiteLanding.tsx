/**
 * WebsiteLanding — the desktop (web, >=960px) marketing site for MealMesh.
 *
 * This is deliberately NOT the app shell: it's a full, sectioned website —
 * nav, hero with a product preview, how-it-works, the constraint-engine value
 * props, a featured-articles strip, a call-to-action band, and a footer with
 * social links. The phone experience stays the focused app (see app/index).
 */

import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Art } from '@/components/art';
import { ArticleMarquee } from '@/components/ArticleMarquee';
import { CuisineMarquee } from '@/components/CuisineMarquee';
import { FoodImage } from '@/components/FoodImage';
import { BrandLockup, SocialBar } from '@/components/SocialBar';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Atmosphere, Reveal } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { usePalette } from '@/theme/use-theme';

const MAXW = 1180;

// The blog is a separate, independently-deployed Astro site (see /blog). Until
// it's live, EXPO_PUBLIC_BLOG_URL is unset and the page falls back to the
// in-page "coming soon" placeholder below instead of linking somewhere dead.
const BLOG_URL = process.env.EXPO_PUBLIC_BLOG_URL;

type FeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  heroImage: string;
  heroImageAlt: string;
  readingTime: string;
  url: string;
};

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

function NavLink({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} style={(s) => [styles.navLink, isHovered(s) && { opacity: 0.6 }]}>
      <Text
        style={{
          fontFamily: active ? Type.bodySemibold : Type.bodyMedium,
          fontSize: 15,
          color: active ? palette.accent : palette.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function dataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Brand-consistent monochrome line icons — replace inconsistent emoji rendering. */
const LINE_ICONS = {
  shield: (c: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${c}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 3l7 3v6c0 5-3.5 7.8-7 9-3.5-1.2-7-4-7-9V6l7-3z'/><path d='M9 12l2 2 4-4'/></svg>`,
  globe: (c: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${c}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='9'/><path d='M3 12h18'/><path d='M12 3c2.5 2.5 4 5.8 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.8-4-9s1.5-6.5 4-9z'/></svg>`,
  cart: (c: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${c}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='9' cy='20' r='1.4' fill='${c}' stroke='none'/><circle cx='18' cy='20' r='1.4' fill='${c}' stroke='none'/><path d='M3 4h2l2.4 12.2a1.6 1.6 0 0 0 1.58 1.3h8.2a1.6 1.6 0 0 0 1.58-1.3L20.5 8H6'/></svg>`,
} satisfies Record<string, (c: string) => string>;

function ValueIcon({ name, color }: { name: keyof typeof LINE_ICONS; color: string }) {
  return <Image source={{ uri: dataUri(LINE_ICONS[name](color)) }} style={{ width: 24, height: 24 }} alt="" />;
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function WebsiteLanding() {
  const palette = usePalette();
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const narrow = width < 760;
  const scrollRef = useRef<ScrollView>(null);
  const anchors = useRef<Record<string, number>>({});
  const [scrolled, setScrolled] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [latestArticles, setLatestArticles] = useState<FeedArticle[] | null>(null);
  const dark = palette.glassTint === 'dark';

  useEffect(() => {
    if (!BLOG_URL) return;
    let cancelled = false;
    fetch(`${BLOG_URL}/feed.json`)
      .then((res) => res.json())
      .then((json: { articles?: FeedArticle[] }) => {
        if (!cancelled && json.articles?.length) setLatestArticles(json.articles);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onAnchor = (key: string) => (e: LayoutChangeEvent) => {
    anchors.current[key] = e.nativeEvent.layout.y;
  };
  const goTo = (key: string) => scrollRef.current?.scrollTo({ y: Math.max(0, (anchors.current[key] ?? 0) - 24), animated: true });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setScrolled(y > 8);
    let current: string | null = null;
    for (const key of ['how', 'why', 'community', 'articles']) {
      if (y >= (anchors.current[key] ?? Infinity) - 120) current = key;
    }
    setActiveKey(current);
  };

  const pad = narrow ? 20 : 40;
  const cards3 = [styles.cards3, narrow && ({ flexDirection: 'column' } as const)];
  const sectionPad = [styles.section, { paddingVertical: narrow ? 52 : 80, paddingHorizontal: pad }];

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Atmosphere />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator
        style={{ flex: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* NAV */}
        <View
          style={[
            Platform.OS === 'web' && ({ position: 'sticky', top: 0, zIndex: 50 } as unknown as ViewStyle),
            scrolled && { borderBottomWidth: 1, borderBottomColor: palette.border },
          ]}
        >
          {scrolled && (
            <BlurView
              intensity={dark ? 24 : 40}
              tint={dark ? 'dark' : 'light'}
              style={[StyleSheet.absoluteFill, { backgroundColor: palette.background + (dark ? 'B3' : 'CC') }]}
            />
          )}
          <Center style={[styles.nav, { paddingHorizontal: pad }]}>
            <BrandLockup palette={palette} size={narrow ? 30 : 36} />
            {narrow ? (
              <View style={styles.navRight}>
                <ThemeSwitcher size={22} />
                {session ? (
                  <CTA label="My home" onPress={() => router.push('/home')} />
                ) : (
                  <CTA label="Start" onPress={() => router.push('/onboarding')} />
                )}
              </View>
            ) : (
              <View style={styles.navRight}>
                <NavLink label="How it works" onPress={() => goTo('how')} active={activeKey === 'how'} />
                <NavLink label="Why MealMesh" onPress={() => goTo('why')} active={activeKey === 'why'} />
                <NavLink label="Community" onPress={() => goTo('community')} active={activeKey === 'community'} />
                <NavLink
                  label="Articles"
                  onPress={() => (BLOG_URL ? Linking.openURL(BLOG_URL) : goTo('articles'))}
                  active={activeKey === 'articles'}
                />
                <NavLink label="Pricing" onPress={() => router.push('/paywall')} />
                <View style={{ width: 6 }} />
                <ThemeSwitcher size={24} />
                <View style={{ width: 6 }} />
                {session ? (
                  <CTA label="Go to my home" onPress={() => router.push('/home')} />
                ) : (
                  <>
                    <CTA label="Sign in" variant="ghost" onPress={() => router.push('/auth')} />
                    <CTA label="Build our plan" onPress={() => router.push('/onboarding')} />
                  </>
                )}
              </View>
            )}
          </Center>
        </View>

        {/* HERO */}
        <Center style={[styles.hero, { paddingHorizontal: pad, flexDirection: narrow ? 'column' : 'row', gap: narrow ? 36 : 56, paddingTop: narrow ? 28 : 48, paddingBottom: narrow ? 56 : 88 }]}>
          <View style={[styles.heroLeft, narrow && { flexGrow: 0, flexBasis: 'auto', width: '100%' }]}>
            <Reveal delay={0}>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>MEAL PLANNING FOR REAL HOUSEHOLDS</Text>
            </Reveal>
            <Reveal delay={70} style={{ marginTop: 10 }}>
              <Text style={[styles.h1, { color: palette.text, fontSize: narrow ? 40 : 56, lineHeight: narrow ? 42 : 58 }]}>
                One household.{'\n'}Many diets.{'\n'}
                <Text style={{ color: palette.accent }}>One plan.</Text>
              </Text>
            </Reveal>
            <Reveal delay={150} style={{ marginTop: 20 }}>
              <Text style={[styles.lead, { color: palette.textSecondary, fontSize: narrow ? 16 : 18 }]}>
                Halal, gluten-free, diabetic, vegan, a picky kid — MealMesh merges every diet at your table into a single
                weekly plan, and one grocery list to match. No cooking three different dinners.
              </Text>
            </Reveal>
            <Reveal delay={220} style={{ marginTop: 22 }}>
              <View style={[styles.heroCtas, narrow && { flexDirection: 'column' }]}>
                <CTA label="Build our plan — free" onPress={() => router.push('/onboarding')} />
                <CTA label="See how it works" variant="ghost" onPress={() => goTo('how')} />
              </View>
            </Reveal>
            <Reveal delay={280} style={{ marginTop: 14, gap: 4 }}>
              <Text style={[styles.trust, { color: palette.textSecondary }]}>
                No card to start · Works on phone & laptop · Your diets stay private
              </Text>
              <Text style={[styles.trust, { color: palette.textSecondary }]}>
                ✓ Built on a deterministic safety engine — not just AI-guessed
              </Text>
            </Reveal>
          </View>

          <Reveal delay={160} style={[styles.heroRight, narrow && { flexGrow: 0, flexBasis: 'auto', width: '100%' }]}>
            <PlanPreview />
          </Reveal>
        </Center>

        {/* CUISINES STRIP */}
        <View style={[{ backgroundColor: palette.backgroundElement }, styles.divider, { borderTopColor: palette.border }]}>
          <Center style={{ paddingTop: narrow ? 36 : 52, paddingHorizontal: pad }}>
            <SectionHead kicker="EVERY KITCHEN" title="Real dishes from every cuisine" />
          </Center>
          <CuisineMarquee cuisines={CUISINES} />
          <View style={{ height: narrow ? 36 : 52 }} />
        </View>

        {/* HOW IT WORKS */}
        <View onLayout={onAnchor('how')}>
          <Center style={sectionPad}>
            <SectionHead kicker="HOW IT WORKS" title="Three steps to one plan everyone can eat" />
            <View style={cards3}>
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
        <View onLayout={onAnchor('why')} style={[{ backgroundColor: palette.backgroundElement }, styles.divider, { borderTopColor: palette.border }]}>
          <Center style={sectionPad}>
            <SectionHead kicker="THE DIFFERENCE" title="Built for safety, not guesswork" />
            <View style={cards3}>
              {VALUES.map((v) => (
                <View key={v.title} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <View style={[styles.valueIconWrap, { backgroundColor: palette.accentMuted }]}>
                    <ValueIcon name={v.icon} color={palette.accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{v.title}</Text>
                  <Text style={[styles.cardBody, { color: palette.textSecondary }]}>{v.body}</Text>
                </View>
              ))}
            </View>
          </Center>
        </View>

        {/* ARTICLES */}
        <View onLayout={onAnchor('articles')} style={{ paddingVertical: narrow ? 52 : 80 }}>
          <Center style={{ paddingHorizontal: pad, marginBottom: Spacing.four }}>
            <SectionHead kicker="FROM THE KITCHEN" title="Guides for multi-diet households" />
          </Center>
          <ArticleMarquee liveArticles={latestArticles} placeholders={ARTICLES} pad={pad} />
        </View>

        {/* COMMUNITY */}
        <View onLayout={onAnchor('community')} style={[{ backgroundColor: palette.backgroundElement }, styles.divider, { borderTopColor: palette.border }]}>
          <Center style={sectionPad}>
            <SectionHead kicker="COOK TOGETHER" title="A community that cooks with you" />
            <View style={cards3}>
              {COMMUNITY.map((c) => (
                <View key={c.title} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <View style={[styles.valueIconWrap, { backgroundColor: palette.accentMuted }]}>
                    <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{c.title}</Text>
                  <Text style={[styles.cardBody, { color: palette.textSecondary }]}>{c.body}</Text>
                </View>
              ))}
            </View>
            <CTA label="Explore the community" onPress={() => router.push('/community')} />
          </Center>
        </View>

        {/* WHO IT'S FOR */}
        <View style={[styles.divider, { borderTopColor: palette.border }]}>
          <Center style={sectionPad}>
            <SectionHead kicker="WHO IT'S FOR" title="Built for the table you actually have" />
            <View style={cards3}>
              {PERSONAS.map((p) => (
                <View key={p.title} style={[styles.review, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <View style={[styles.reviewerIcon, { backgroundColor: palette.accentMuted, borderColor: palette.border }]}>
                    <Image source={p.art} resizeMode="contain" style={{ width: 26, height: 26 }} alt="" />
                  </View>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{p.title}</Text>
                  <Text style={[styles.cardBody, { color: palette.textSecondary }]}>{p.body}</Text>
                </View>
              ))}
            </View>
          </Center>
        </View>

        {/* PRICING */}
        <View>
          <Center style={sectionPad}>
            <SectionHead kicker="PRICING" title="Free to start. Fair pricing wherever you live." />
            <View style={cards3}>
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.eyebrow, { color: palette.accent }]}>FREE</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                  <Text style={{ fontFamily: Type.displayBold, fontSize: 34, color: palette.text }}>$0</Text>
                </View>
                <Text style={[styles.cardBody, { color: palette.textSecondary, marginTop: 6 }]}>
                  1 member profile · 3 AI plans a week · basic grocery list
                </Text>
              </View>
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.accent, borderWidth: 1.5 }]}>
                <Text style={[styles.eyebrow, { color: palette.accent }]}>PRO · RECOMMENDED MONTHLY</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                  <Text style={{ fontFamily: Type.displayBold, fontSize: 34, color: palette.text }}>from $2.99</Text>
                  <Text style={[styles.cardBody, { color: palette.textSecondary }]}>/month</Text>
                </View>
                <Text style={[styles.cardBody, { color: palette.textSecondary, marginTop: 6 }]}>
                  Unlimited plans & profiles · all 40+ diets · regional cuisines · grocery export. Your exact price
                  adapts to where you live — see it on the next screen, before you pay anything.
                </Text>
              </View>
            </View>
            <CTA label="See your price" onPress={() => router.push('/paywall')} />
          </Center>
        </View>

        {/* CTA BAND */}
        <Center style={{ paddingVertical: 24, paddingHorizontal: pad }}>
          <View style={[styles.band, { backgroundColor: palette.accent, paddingVertical: narrow ? 40 : 56, paddingHorizontal: pad }]}>
            <Text style={[styles.bandTitle, { color: palette.onAccent, fontSize: narrow ? 24 : 30 }]}>Ready to feed everyone at your table?</Text>
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
          <Center style={[styles.footerInner, { paddingHorizontal: pad }]}>
            <View style={styles.footerBrand}>
              <BrandLockup palette={palette} size={34} />
              <Text style={[styles.cardBody, { color: palette.textSecondary, maxWidth: 280 }]}>
                One household. Many diets. One plan. One grocery list.
              </Text>
              <SocialBar palette={palette} />
              <NewsletterCapture />
            </View>
            <View style={styles.footerCols}>
              <FooterCol title="Product" links={[['Build a plan', () => router.push('/onboarding')], ['Pricing', () => router.push('/paywall')], ['Cook from pantry', () => router.push('/pantry')]]} />
              <FooterCol
                title="Company"
                links={[
                  ['Articles', () => (BLOG_URL ? Linking.openURL(BLOG_URL) : goTo('articles'))],
                  ['How it works', () => goTo('how')],
                  session ? ['Go to my home', () => router.push('/home')] : ['Sign in', () => router.push('/auth')],
                ]}
              />
              <FooterCol title="Legal" links={[['Privacy', () => router.push('/privacy')], ['Terms', () => router.push('/terms')]]} />
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

/** Opens a real mail draft to a real inbox — no fake "subscribed!" with nothing behind it. */
function NewsletterCapture() {
  const palette = usePalette();
  const [email, setEmail] = useState('');
  const valid = email.includes('@') && email.includes('.');

  const send = () => {
    if (!valid) return;
    const subject = encodeURIComponent('New guides — sign me up');
    const body = encodeURIComponent(`Please add this address to the guides list: ${email}`);
    Linking.openURL(`mailto:hello@mealmesh.app?subject=${subject}&body=${body}`);
  };

  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      <Text style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.text }}>Get new guides in your inbox</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={palette.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.newsletterInput, { borderColor: palette.border, color: palette.text }]}
        />
        <Pressable
          onPress={send}
          disabled={!valid}
          style={(s) => [styles.newsletterBtn, { backgroundColor: palette.accent }, (!valid || isHovered(s)) && { opacity: valid ? 0.9 : 0.5 }]}
        >
          <Text style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.onAccent }}>Notify me</Text>
        </Pressable>
      </View>
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

const CUISINES = [
  { art: Art.rice, label: 'South Asian' },
  { art: Art.ramen, label: 'East Asian' },
  { art: Art.tacos, label: 'Latin' },
  { art: Art.steak, label: 'High-protein' },
  { art: Art.sandwich, label: 'Everyday' },
  { art: Art.fruits, label: 'Fresh & raw' },
  { art: Art.cinnamon, label: 'Breakfast' },
];

const PERSONAS = [
  {
    art: Art.rice,
    title: 'Mixed-diet families',
    body: 'One person is halal, another gluten-free, a third just eats differently. MealMesh builds the week around all of it at once, not three separate dinners.',
  },
  {
    art: Art.sandwich,
    title: 'Medically careful households',
    body: 'Diabetic, low-sodium, a nut allergy in the mix — the hard-exclude checks run in code before any plan ever reaches your table.',
  },
  {
    art: Art.fruits,
    title: 'Picky eaters & busy parents',
    body: 'Keep a kid’s usual favourites in rotation while everyone else gets real variety — and still only one grocery list to manage.',
  },
];

const STEPS = [
  { title: 'Add your household', body: 'Each person, each diet — halal, gluten-free, diabetic, allergies, the lot. Tap a few chips and you’re done.' },
  { title: 'We merge every diet', body: 'Our engine computes what’s safe for everyone, then asks our AI for real, culturally-aware dishes.' },
  { title: 'One plan, one list', body: 'Get a 7-day plan plus a single consolidated grocery list. Shared dishes where possible, simple swaps where needed.' },
];

const COMMUNITY: { emoji: string; title: string; body: string }[] = [
  { emoji: '📸', title: 'Share what you cook', body: 'Post a photo of tonight’s dinner, swap recipes, and get ideas from other home cooks juggling the same diets.' },
  { emoji: '🔥', title: 'Build streaks & climb', body: 'Mark meals cooked to earn points and badges, keep a daily streak, and see where you rank on the leaderboard.' },
  { emoji: '👥', title: 'Follow other cooks', body: 'Find people cooking for a table like yours, follow them, and cook their recipes in one tap.' },
];

const VALUES: { icon: keyof typeof LINE_ICONS; title: string; body: string }[] = [
  { icon: 'shield', title: 'Safety-first engine', body: 'Allergens and religious rules are hard-enforced in code — a deterministic check, never left to the model alone.' },
  { icon: 'globe', title: 'Culturally aware', body: 'Halal, kosher, Jain, South-Asian, Mediterranean and more — real dishes with local names, not bland substitutes.' },
  { icon: 'cart', title: 'One grocery list', body: 'Every meal for every member, merged into a single checkable shopping list calibrated to your budget.' },
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
  heroLeft: { flex: 1.05 },
  heroRight: { flex: 0.95, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: Type.bodySemibold, fontSize: 13, letterSpacing: 1.6 },
  h1: { fontFamily: Type.displayBold, fontSize: 56, lineHeight: 60 },
  lead: { fontFamily: Type.body, fontSize: 18, lineHeight: 28, maxWidth: 520 },
  heroCtas: { flexDirection: 'row', gap: 12, marginTop: 4 },
  trust: { fontFamily: Type.body, fontSize: 13 },

  section: { paddingVertical: 80 },
  divider: { borderTopWidth: 1 },
  h2: { fontFamily: Type.displayBold, fontSize: 34, lineHeight: 40, textAlign: 'center', maxWidth: 640 },

  cards3: { flexDirection: 'row', gap: 24, alignItems: 'stretch' },
  card: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: 10 },
  stepNum: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  valueIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cardTitle: { fontFamily: Type.displayBold, fontSize: 19, lineHeight: 24 },
  cardBody: { fontFamily: Type.body, fontSize: 14.5, lineHeight: 22 },


  review: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: 10 },
  reviewerIcon: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },

  band: { width: '100%', borderRadius: Radius.xl, paddingVertical: 56, paddingHorizontal: 40, alignItems: 'center', gap: 12 },
  bandTitle: { fontFamily: Type.displayBold, fontSize: 30, textAlign: 'center' },
  bandSub: { fontFamily: Type.body, fontSize: 16, textAlign: 'center', opacity: 0.92 },
  bandBtn: { height: 52, paddingHorizontal: 28, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 8 },

  footer: { borderTopWidth: 1, paddingTop: 56, paddingBottom: 28, marginTop: 24 },
  footerInner: { flexDirection: 'row', justifyContent: 'space-between', gap: 48, flexWrap: 'wrap' },
  footerBrand: { gap: 16, maxWidth: 320 },
  footerCols: { flexDirection: 'row', gap: 64 },
  footerBottom: { borderTopWidth: 1, marginTop: 40, paddingTop: 24 },
  newsletterInput: { flex: 1, height: 40, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 14, fontFamily: Type.body, fontSize: 13, maxWidth: 200 },
  newsletterBtn: { height: 40, paddingHorizontal: 16, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },

  preview: { width: '100%', maxWidth: 440, borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.four, gap: 4, shadowColor: '#0B2B26', shadowOpacity: 0.1, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } },
  previewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  everyDiet: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: 1 },
  previewThumb: { width: 52, height: 52 },
});
