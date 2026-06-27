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
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SheetModal } from '@/components/SheetModal';
import { BrandLockup } from '@/components/SocialBar';
import { Avatar, PressableScale, useIsDesktop } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getMyProfile } from '@/lib/social';
import { usePalette } from '@/theme/use-theme';
import type { Profile } from '@/types';

const LOGO = require('../../assets/logo.svg');

export type HeaderTab = 'home' | 'plan' | 'community' | 'leaderboard';

const LINKS: { key: HeaderTab; label: string; path: '/home' | '/plan' | '/community' | '/leaderboard' }[] = [
  { key: 'home', label: 'Home', path: '/home' },
  { key: 'plan', label: 'Plan', path: '/plan' },
  { key: 'community', label: 'Community', path: '/community' },
  { key: 'leaderboard', label: 'Leaderboard', path: '/leaderboard' },
];

export function AppHeader({ active }: { active?: HeaderTab }) {
  const router = useRouter();
  const palette = usePalette();
  const isDesktop = useIsDesktop();
  const { session } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
        <PressableScale onPress={() => Linking.openURL('https://www.getmealmesh.com')} to={0.96}>
          {isDesktop ? (
            <BrandLockup palette={palette} size={30} />
          ) : (
            <Image source={LOGO} alt="" style={{ width: 30, height: 30, borderRadius: 9 }} />
          )}
        </PressableScale>

        <View style={[styles.links, { gap: isDesktop ? Spacing.one : 0 }]}>
          {LINKS.filter((l) => l.key !== 'home' || isDesktop).map((l) => {
            const on = active === l.key;
            return (
              <PressableScale key={l.key} onPress={() => router.push(l.path)} to={0.94}>
                <View style={[styles.link, { paddingHorizontal: isDesktop ? Spacing.three : 9 }, on && { backgroundColor: palette.accentMuted }]}>
                  <Text
                    style={{
                      fontFamily: on ? Type.bodySemibold : Type.bodyMedium,
                      fontSize: isDesktop ? 14 : 12.5,
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
});
