import {
  buildGazetteer,
  deriveCourse,
  enrichCuisine,
  normalizeTitle,
  MIN_CONFIDENCE,
  type Gazetteer,
} from '@/lib/enrichCuisine';

import nationalDishes from '../../data/national-dishes.json';
import countryToRegion from '../../data/country-to-region.json';
import titleRules from '../../data/title-cuisine-rules.json';
import regionProfiles from '../../data/region-ingredient-profiles.json';

const gaz: Gazetteer = buildGazetteer({
  nationalDishes: nationalDishes as Record<string, string>,
  countryToRegion: countryToRegion as Record<string, string>,
  titleRules: titleRules as { rules: Gazetteer['titleRules'] },
  regionProfiles: regionProfiles as { profiles: Record<string, Record<string, number>> },
});

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeTitle("  Mom's  BEST Chicken-Biryani! ")).toBe('mom s best chicken biryani');
  });
});

describe('enrichCuisine — national dish (highest confidence)', () => {
  it('tags an exact national dish with country + region', () => {
    const r = enrichCuisine('Biryani', [], gaz);
    expect(r.cuisine).toBe('south_asian');
    expect(r.countryOrigin).toBe('PK');
    expect(r.method).toBe('national_dish');
    expect(r.confidence).toBeGreaterThanOrEqual(90);
  });

  it('tags tacos -> latin / MX', () => {
    const r = enrichCuisine('Tacos', [], gaz);
    expect(r.cuisine).toBe('latin');
    expect(r.countryOrigin).toBe('MX');
  });

  it('matches a dish embedded in a longer title (substring)', () => {
    const r = enrichCuisine('Easy Weeknight Chicken Tikka Masala', [], gaz);
    expect(r.cuisine).toBe('south_asian');
    expect(r.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
  });
});

describe('enrichCuisine — title keyword rule (second tier)', () => {
  it('tags a teriyaki dish to east_asian / JP via keyword', () => {
    const r = enrichCuisine('Sheet Pan Teriyaki Salmon Bowls', [], gaz);
    expect(r.cuisine).toBe('east_asian');
    expect(r.countryOrigin).toBe('JP');
    expect(r.method).toBe('title_rule');
  });
});

describe('enrichCuisine — ingredient fingerprint (third tier)', () => {
  it('tags by characteristic ingredients when the title gives no cue', () => {
    const r = enrichCuisine('Weeknight Dinner Bowl', ['gochujang', 'kimchi', 'sesame oil', 'rice'], gaz);
    expect(r.cuisine).toBe('east_asian');
    expect(r.method).toBe('ingredient_fp');
    expect(r.confidence).toBeGreaterThanOrEqual(70);
    expect(r.confidence).toBeLessThanOrEqual(85);
  });

  it('returns a no-match (confidence 0) for an untaggable recipe', () => {
    const r = enrichCuisine('Plain Boiled Water', ['water'], gaz);
    expect(r.confidence).toBe(0);
    expect(r.method).toBe('none');
    expect(r.confidence).toBeLessThan(MIN_CONFIDENCE);
  });
});

describe('deriveCourse', () => {
  it('classifies desserts, breakfasts, and defaults to main', () => {
    expect(deriveCourse('Chocolate Lava Cake')).toBe('dessert');
    expect(deriveCourse('Fluffy Buttermilk Pancakes')).toBe('breakfast');
    expect(deriveCourse('Grilled Lamb Chops')).toBe('main');
  });
});
