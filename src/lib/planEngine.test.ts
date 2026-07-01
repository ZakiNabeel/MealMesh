import { makeConstraint } from '@/lib/constraints';
import { getCorpus } from '@/lib/corpus';
import { generateLocalPlan } from '@/lib/planEngine';
import { analyzeIngredient } from '@/lib/constraints';
import { unionHardExclusions } from '@/lib/constraints';
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

describe('local plan engine', () => {
  it('produces a complete 35-slot week', () => {
    const plan = generateLocalPlan(household([member('a', [])]), getCorpus(), 0);
    expect(plan.days).toHaveLength(35);
    expect(plan.grocery.length).toBeGreaterThan(0);
  });

  it('never includes a hard-excluded ingredient (halal + nut allergy household)', () => {
    const members = [member('a', ['halal']), member('b', ['tree_nuts'])];
    const hard = new Set(unionHardExclusions(members));
    const plan = generateLocalPlan(household(members), getCorpus(), 3);
    for (const meal of plan.days) {
      for (const ing of meal.ingredients) {
        for (const t of analyzeIngredient(ing)) {
          expect(hard.has(t)).toBe(false);
        }
      }
    }
  });

  it('pulls authentic corpus dishes into a Pakistani household plan', () => {
    const plan = generateLocalPlan(
      household([member('a', ['halal'])], { country: 'PK', region: 'south_asian' }),
      getCorpus(),
      1,
    );
    const names = plan.days.map((d) => d.name);
    // At least one real seeded dish title should surface (vs only procedural).
    const corpusTitles = new Set(getCorpus().map((r) => r.title));
    expect(names.some((n) => corpusTitles.has(n))).toBe(true);
  });

  it('gives a kosher household a FULL 35-meal week (no dropped meals)', () => {
    // Regression: kosher forbids meat+dairy in one meal. The generator used to
    // build meat meals with yogurt, which the safety pass then DROPPED, leaving
    // some days with only 2-3 meals. Every slot must now be filled and safe.
    const members = [member('a', ['kosher']), member('b', ['halal'])];
    const plan = generateLocalPlan(household(members), getCorpus(), 4);
    expect(plan.days).toHaveLength(35);

    const LAND_MEAT = ['meat', 'poultry', 'beef', 'red_meat', 'pork'];
    for (const meal of plan.days) {
      const toks = new Set<string>();
      for (const ing of meal.ingredients) for (const t of analyzeIngredient(ing)) toks.add(t);
      const hasMeat = LAND_MEAT.some((t) => toks.has(t));
      const hasDairy = toks.has('dairy') || toks.has('lactose');
      expect(hasMeat && hasDairy).toBe(false); // never meat + dairy in one meal
    }
  });

  it('is deterministic for the same household + seed', () => {
    const h = household([member('a', [])], { country: 'PK' });
    const a = generateLocalPlan(h, getCorpus(), 5);
    const b = generateLocalPlan(h, getCorpus(), 5);
    expect(a.days.map((d) => d.name)).toEqual(b.days.map((d) => d.name));
  });
});
