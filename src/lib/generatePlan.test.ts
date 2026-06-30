// Avoid loading the real Supabase client (react-native ESM jest can't
// transform). Unconfigured ⇒ generation uses the offline seed corpus.
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

import { generatePlan } from '@/lib/generatePlan';
import { analyzeIngredient, unionHardExclusions } from '@/lib/constraints';
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

describe('generatePlan (client entry → fetchCorpus → engine)', () => {
  it('produces a complete, safety-validated 35-slot week', async () => {
    const members = [member('a', ['halal']), member('b', ['vegan', 'tree_nuts'])];
    const plan = await generatePlan(household(members), 0, false);
    expect(plan.days).toHaveLength(35);
    expect(plan.grocery.length).toBeGreaterThan(0);

    const hard = new Set(unionHardExclusions(members));
    for (const meal of plan.days) {
      for (const ing of meal.ingredients) {
        for (const t of analyzeIngredient(ing)) {
          expect(hard.has(t)).toBe(false);
        }
      }
    }
  });

  it('honors a multi-cuisine mix across the week', async () => {
    const h = household([member('a', [])], {
      region: 'south_asian',
      cuisines: [
        { region: 'south_asian', percent: 60 },
        { region: 'chinese', percent: 40 },
      ],
    });
    const plan = await generatePlan(h, 2, false);
    const cuisines = new Set(plan.days.map((d) => d.cuisine));
    // Both cuisines should appear somewhere in the 35 slots.
    expect(cuisines.size).toBeGreaterThan(1);
  });

  it('is deterministic for the same household + seed', async () => {
    const h = household([member('a', [])], { country: 'PK' });
    const a = await generatePlan(h, 7, false);
    const b = await generatePlan(h, 7, false);
    expect(a.days.map((d) => d.name)).toEqual(b.days.map((d) => d.name));
  });
});
