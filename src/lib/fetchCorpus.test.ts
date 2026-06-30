// Avoid loading the real Supabase client (pulls in react-native ESM jest can't
// transform). Unconfigured ⇒ fetchCorpus exercises the seed-fallback path.
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

import { fetchCorpusForHousehold, clearCorpusCache } from '@/lib/fetchCorpus';
import { fromDbRow, type CorpusRow, householdHardExclude, isRecipeSafe } from '@/lib/recipeCorpus';
import { makeConstraint } from '@/lib/constraints';
import type { Household, Member } from '@/types';

const member = (id: string, keys: Parameters<typeof makeConstraint>[0][]): Member => ({
  id,
  name: id,
  ageBand: 'adult',
  calorieTarget: null,
  constraints: keys.map((k) => makeConstraint(k)),
});

const household = (members: Member[], extra: Partial<Household> = {}): Household => ({
  id: 'h',
  name: 'Test',
  region: 'south_asian',
  members,
  ...extra,
});

beforeEach(() => clearCorpusCache());

describe('fromDbRow', () => {
  const row: CorpusRow = {
    title: 'Chicken Karahi',
    cuisine: 'south_asian',
    country_origin: 'PK',
    course: 'dinner',
    ingredients: [{ name: 'chicken' }, { name: 'tomato' }],
    steps: ['cook'],
    servings: 4,
    time_minutes: 40,
    exclusion_tokens: ['poultry', 'meat', 'animal_flesh', 'nightshades'],
    diet_compatible: ['halal'],
    cost_tier: 2,
    health_score: 3,
    source: 'MealMesh original',
    license: 'original',
    attribution_url: null,
  };

  it('maps snake_case DB columns to the TaggedRecipe shape', () => {
    const r = fromDbRow(row);
    expect(r.title).toBe('Chicken Karahi');
    expect(r.countryOrigin).toBe('PK');
    expect(r.timeMinutes).toBe(40);
    expect(r.exclusionTokens).toContain('poultry');
    expect(r.dietCompatible).toContain('halal');
  });

  it('clamps out-of-range tiers/scores defensively', () => {
    const r = fromDbRow({ ...row, cost_tier: 9, health_score: 0 });
    expect(r.costTier).toBe(3);
    expect(r.healthScore).toBe(1);
  });
});

describe('fetchCorpusForHousehold (seed fallback — Supabase unconfigured in tests)', () => {
  it('returns a non-empty pool from the seed corpus', async () => {
    const pool = await fetchCorpusForHousehold(household([member('a', [])]));
    expect(pool.length).toBeGreaterThan(0);
  });

  it('applies the household HARD_EXCLUDE filter (no unsafe dish for a halal + nut-allergy home)', async () => {
    const members = [member('a', ['halal']), member('b', ['tree_nuts'])];
    const hard = householdHardExclude(members);
    const pool = await fetchCorpusForHousehold(household(members));
    expect(pool.length).toBeGreaterThan(0);
    for (const r of pool) {
      expect(isRecipeSafe(r.exclusionTokens, hard)).toBe(true);
    }
  });

  it('memoizes per (regions + hard-exclude) within a session', async () => {
    const h = household([member('a', [])]);
    const a = await fetchCorpusForHousehold(h);
    const b = await fetchCorpusForHousehold(h);
    expect(a).toBe(b); // same array reference from the cache
  });
});
