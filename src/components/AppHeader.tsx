/**
 * AppHeader — the persistent top chrome for every signed-in app screen.
 *
 * Left: brand → Home. Middle: Plan · Community · Leaderboard (with an `active`
 * highlight). Right: an account control — the user's avatar opening a dropdown
 * (email, My profile, Settings, Sign out), or a "Sign in" CTA when signed out.
 *
 * It renders OUTSIDE each screen's ScrollView (as a sibling above it via the
 * Screen `header` slot), so it stays pinned while content scrolls.
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { SheetModal } from '@/components/SheetModal';
import { BrandLockup } from '@/components/SocialBar';
import { Avatar, PressableScale, useIsDesktop } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getMyProfile } from '@/lib/social';
import { useSubscription } from '@/lib/subscription';
import { usePalette } from '@/theme/use-theme';
import type { Profile } from '@/types';

const LOGO = require('../../assets/logo.svg');

export type HeaderTab = 'home' | 'plan' | 'community' | 'leaderboard' | 'guest' | 'surprise';

const LINKS: {
  key: HeaderTab;
  label: string;
  path: '/home' | '/plan' | '/community' | '/leaderboard' | '/surprise';
  /** "Guest mode" and "Surprise me" are the same Pro-gated screen opened to a
   *  different starting mode — kept as two distinct nav entries since
   *  they're different features to the user (hosting guests vs. a solo idea). */
  params?: { mode: 'guests' | 'me' };
}[] = [
  { key: 'home', label: 'Home', path: '/home' },
  { key: 'plan', label: 'Plan', path: '/plan' },
  { key: 'community', label: 'Community', path: '/community' },
  { key: 'leaderboard', label: 'Leaderboard', path: '/leaderboard' },
  { key: 'guest', label: 'Guest mode', path: '/surprise', params: { mode: 'guests' } },
  { key: 'surprise', label: 'Surprise me', path: '/surprise', params: { mode: 'me' } },
];

export function AppHeader({ active }: { active?: HeaderTab }) {
  const router = useRouter();
  const palette = usePalette();
  const isDesktop = useIsDesktop();
  const { session } = useAuth();
  const { isPro, loading: subLoading } = useSubscription();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    void getMyProfile().then(setProfile);
  }, [session]);

  return (
    <View style={[styles.bar, { borderBottomColor: palette.border, backgroundColor: palette.background }]}>
      <View style={[styles.inner, { paddingHorizontal: isDesktop ? Spacing.four : Spacing.three, gap: isDesktop ? Spacing.three : Spacing.two }]}>
        {!isDesktop && (
          <PressableScale onPress={() => setNavOpen(true)} to={0.92}>
            <View style={styles.hamburger}>
              <View style={[styles.hamburgerBar, { backgroundColor: palette.text }]} />
              <View style={[styles.hamburgerBar, { backgroundColor: palette.text }]} />
              <View style={[styles.hamburgerBar, { backgroundColor: palette.text }]} />
            </View>
          </PressableScale>
        )}

        {/* Internal route, not an external reload — same marketing page the
            "/" route already renders (signed in or not), just without the
            full page reload an external URL would force. */}
        <PressableScale onPress={() => router.push('/')} to={0.96}>
          {isDesktop ? (
            <BrandLockup palette={palette} size={30} />
          ) : (
            <Image source={LOGO} alt="" style={{ width: 30, height: 30, borderRadius: 9 }} />
          )}
        </PressableScale>

        {isDesktop && (
          <View style={[styles.links, { gap: Spacing.one }]}>
            {LINKS.map((l) => {
              const on = active === l.key;
              return (
                <PressableScale key={l.key} onPress={() => router.push(l.params ? { pathname: l.path, params: l.params } : l.path)} to={0.94}>
                  <View style={[styles.link, { paddingHorizontal: Spacing.three }, on && { backgroundColor: palette.accentMuted }]}>
                    <Text
                      style={{
                        fontFamily: on ? Type.bodySemibold : Type.bodyMedium,
                        fontSize: 14,
                        color: on ? palette.accent : palette.textSecondary,
                      }}
                    >
                      {l.label}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        )}

        {!isDesktop && <View style={{ flex: 1 }} />}

        {session && !isPro && !subLoading && (
          <PressableScale onPress={() => router.push('/paywall')} to={0.94}>
            <View style={[styles.proPill, { backgroundColor: palette.accentMuted, borderColor: palette.accent }]}>
              <Text style={{ fontFamily: Type.bodySemibold, fontSize: isDesktop ? 13 : 12, color: palette.accent }}>
                {isDesktop ? '✦ Get unlimited plans — Go Pro' : '✦ Pro'}
              </Text>
            </View>
          </PressableScale>
        )}

        {session ? (
          <View>
            <PressableScale onPress={() => setMenuOpen((v) => !v)} to={0.92}>
              <Avatar name={profile?.displayName || profile?.username || 'you'} uri={profile?.avatarUrl} size={34} />
            </PressableScale>
            {/* Desktop: anchored popover. Mobile: bottom sheet (below). */}
            {isDesktop && menuOpen && (
              <>
                <Pressable style={styles.scrim} onPress={() => setMenuOpen(false)} />
                <View style={[styles.popover, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <AccountMenu onNavigate={() => setMenuOpen(false)} />
                </View>
              </>
            )}
          </View>
        ) : (
          <PressableScale onPress={() => router.push('/auth')} to={0.94}>
            <View style={[styles.signIn, { backgroundColor: palette.accent }]}>
              <Text style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.onAccent }}>Sign in</Text>
            </View>
          </PressableScale>
        )}
      </View>

      {!isDesktop && <NavDrawer visible={navOpen} onClose={() => setNavOpen(false)} active={active} />}

      {!isDesktop && (
        <SheetModal visible={menuOpen} onClose={() => setMenuOpen(false)} maxWidth={420}>
          <View style={{ padding: Spacing.four }}>
            <AccountMenu onNavigate={() => setMenuOpen(false)} />
          </View>
        </SheetModal>
      )}
    </View>
  );
}

const DRAWER_WIDTH = 280;

/**
 * Mobile nav — a left-edge side panel instead of cramming six links into the
 * header row, which used to overflow off-screen on phone-width viewports.
 * Stays mounted through the close animation (the slide-out), then unmounts.
 */
function NavDrawer({ visible, onClose, active }: { visible: boolean; onClose: () => void; active?: HeaderTab }) {
  const palette = usePalette();
  const router = useRouter();
  const [mounted, setMounted] = useState(visible);
  const x = useSharedValue(visible ? 0 : -DRAWER_WIDTH);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      x.value = withTiming(0, { duration: 220 });
    } else if (mounted) {
      x.value = withTiming(-DRAWER_WIDTH, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (!mounted) return null;

  const go = (l: (typeof LINKS)[number]) => {
    onClose();
    router.push(l.params ? { pathname: l.path, params: l.params } : l.path);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <Animated.View style={[styles.drawer, animatedStyle, { backgroundColor: palette.background, borderRightColor: palette.border }]}>
        <View style={{ padding: Spacing.four, gap: Spacing.one }}>
          {LINKS.map((l) => {
            const on = active === l.key;
            return (
              <PressableScale key={l.key} onPress={() => go(l)} to={0.97}>
                <View style={[styles.drawerLink, on && { backgroundColor: palette.accentMuted }]}>
                  <Text style={{ fontFamily: on ? Type.bodySemibold : Type.bodyMedium, fontSize: 16, color: on ? palette.accent : palette.text }}>
                    {l.label}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
}

/** The shared dropdown/sheet body: email header + actions. */
function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const palette = usePalette();
  const { user, signOut } = useAuth();

  const go = (path: '/profile' | '/settings') => {
    onNavigate();
    router.push(path);
  };

  return (
    <View style={{ gap: 2 }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }}>
        <Text numberOfLines={1} style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.text }}>
          {user?.email ?? 'Your account'}
        </Text>
      </View>
      <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 4 }} />
      <MenuItem label="My profile" onPress={() => go('/profile')} />
      <MenuItem label="Settings" onPress={() => go('/settings')} />
      <MenuItem
        label="Sign out"
        danger
        onPress={async () => {
          onNavigate();
          await signOut();
          router.replace('/');
        }}
      />
    </View>
  );
}

function MenuItem({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.menuItem,
        hovered && { backgroundColor: palette.backgroundElement },
      ]}
    >
      <Text style={{ fontFamily: Type.bodyMedium, fontSize: 14, color: danger ? palette.danger : palette.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Explicit zIndex (with RN's default position:relative) gives the whole
  // header its own stacking context above page content, so the account
  // popover — anchored inside it — always paints on top of cards below,
  // regardless of DOM order or blur/filter effects those cards use.
  bar: { width: '100%', borderBottomWidth: 1, zIndex: 30 },
  inner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  links: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.one, flexWrap: 'nowrap' },
  link: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.pill },
  proPill: { paddingHorizontal: Spacing.three, height: 34, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  signIn: { paddingHorizontal: Spacing.three, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  scrim: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  popover: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 200,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    zIndex: 50,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 30px rgba(0,0,0,0.16)' } as object)
      : { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 }),
  },
  menuItem: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.sm },
  hamburger: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', gap: 5 },
  hamburgerBar: { width: 18, height: 2, borderRadius: 1 },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    borderRightWidth: 1,
    zIndex: 50,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '12px 0 30px rgba(0,0,0,0.16)' } as object)
      : { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 10, height: 0 }, elevation: 8 }),
  },
  drawerLink: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, borderRadius: Radius.md },
});
