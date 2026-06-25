import type { ImageSourcePropType } from 'react-native';

/**
 * Recoloured food cliparts (white → transparent, lines → brand green/blue),
 * generated from assets/cliparts via Pillow. One ambient watermark per screen.
 */
export const Art = {
  rice: require('../../assets/cliparts/processed/rice.png') as ImageSourcePropType,
  ramen: require('../../assets/cliparts/processed/ramen.png') as ImageSourcePropType,
  fruits: require('../../assets/cliparts/processed/fruits.png') as ImageSourcePropType,
  steak: require('../../assets/cliparts/processed/steak.png') as ImageSourcePropType,
  sandwich: require('../../assets/cliparts/processed/sandwich.png') as ImageSourcePropType,
  tacos: require('../../assets/cliparts/processed/tacos.png') as ImageSourcePropType,
  cinnamon: require('../../assets/cliparts/processed/cinnamon.png') as ImageSourcePropType,
} as const;
