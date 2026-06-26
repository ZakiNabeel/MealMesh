/**
 * Flag — a country flag that actually renders everywhere.
 *
 * Emoji flags (regional-indicator pairs) DON'T render on Windows/Chrome — they
 * show as bare letters. So on web we use real flag images from flagcdn.com; on
 * native (iOS/Android, where emoji flags render fine) we keep the emoji.
 */

import { Image, Platform, Text, View } from 'react-native';

import { flagEmoji } from '@/lib/geo';

export function Flag({ code, size = 22 }: { code: string; size?: number }) {
  if (Platform.OS === 'web') {
    const w = Math.round(size * 1.4);
    return (
      <View style={{ width: w, height: size, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.12)' }}>
        <Image
          source={{ uri: `https://flagcdn.com/w80/${code.toLowerCase()}.png` }}
          resizeMode="cover"
          style={{ width: w, height: size }}
          accessibilityLabel={`${code} flag`}
        />
      </View>
    );
  }
  return <Text style={{ fontSize: size }}>{flagEmoji(code)}</Text>;
}
