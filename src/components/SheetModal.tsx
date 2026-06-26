/**
 * SheetModal — one modal that feels right on both form factors.
 *
 * On phones it's a bottom sheet that slides up; on desktop it's a centered
 * dialog (so it never sticks to a screen edge). A flex wrapper does the
 * centering — absolutely-positioned children with `alignSelf` don't actually
 * centre in react-native-web, which is why the old sheets drifted to one side.
 * The inner content scrolls with a normal mouse wheel.
 */

import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useIsDesktop } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/theme/use-theme';

export function SheetModal({
  visible,
  onClose,
  children,
  maxWidth = 480,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  const palette = usePalette();
  const isDesktop = useIsDesktop();

  return (
    <Modal visible={visible} transparent animationType={isDesktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.wrap, { justifyContent: isDesktop ? 'center' : 'flex-end', padding: isDesktop ? 24 : 0 }]} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.background,
              borderColor: palette.border,
              maxWidth: isDesktop ? Math.max(maxWidth, 560) : maxWidth,
              maxHeight: isDesktop ? '88%' : '92%',
              borderRadius: isDesktop ? Radius.xl : 0,
              borderTopLeftRadius: Radius.xl,
              borderTopRightRadius: Radius.xl,
            },
          ]}
        >
          {!isDesktop && <View style={styles.grabber} />}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center' },
  sheet: { width: '100%', borderWidth: 1, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: 'rgba(127,127,127,0.4)', marginTop: 10, marginBottom: 4 },
});
