import { makeConstraint } from '@/lib/constraints';
import { householdHardExclude, isRecipeSafe, tagRecipe, type RawRecipe } from '@/lib/recipeCorpus';
import type { Member } from '@/types';

const member = (id: string, keys: Parameters<typeof makeConstraint>[0][]): Member => ({
  id,
  name: id,
  ageBand: 'adult',
  calorieTarget: null,
  constraints: keys.map((k) => makeConstraint(k)),
});

const porkDish: RawRecipe = {
  title: 'Pork belly stir-fry',
  cuisine: 'chinese',
  course: 'dinner',
  ingredients: [{ name: 'pork belly' }, { name: 'white rice' }, { name: 'scallion' }],
  steps: ['Fry the pork belly.', 'Toss with rice.'],
};

const chickenDish: RawRecipe = {
  title: 'Chicken karahi',
  cuisine: 'south_asian',
  countryOrigin: 'PK',
  course: 'dinner',
  ingredients: [{ name: 'chicken' }, { name: 'tomato' }, { name: 'white rice' }],
  steps: ['Grill the chicken.', 'Simmer with tomato.'],
};

describe('recipe corpus tagging (deterministic safety at ingest)', () => {
  it('is deterministic — identical input yields identical exclusion tokens', () => {
    const a = tagRecipe(porkDish);
    const b = tagRecipe(porkDish);
    expect(a.exclusionTokens.sort()).toEqual(b.exclusionTokens.sort());
  });

  it('detects pork and marks the dish incompatible with halal', () => {
    const tagged = tagRecipe(porkDish);
    expect(tagged.exclusionTokens).toContain('pork');
    expect(tagged.dietCompatible).not.toContain('halal');
  });

  it('marks a chicken+rice dish compatible with halal', () => {
    const tagged = tagRecipe(chickenDish);
    expect(tagged.exclusionTokens).not.toContain('pork');
    expect(tagged.dietCompatible).toContain('halal');
  });

  it('scores a grilled lean-protein dish healthier than a fried fatty one', () => {
    const grilled = tagRecipe(chickenDish);
    const fried = tagRecipe(porkDish);
    expect(grilled.healthScore).toBeGreaterThan(fried.healthScore);
  });
});

describe('runtime safety filter (exact, no model)', () => {
  it('rejects a pork dish for a halal household and accepts the chicken dish', () => {
    const members = [member('a', ['halal']), member('b', ['gluten_free'])];
    const hard = householdHardExclude(members);
    expect(isRecipeSafe(tagRecipe(porkDish).exclusionTokens, hard)).toBe(false);
    expect(isRecipeSafe(tagRecipe(chickenDish).exclusionTokens, hard)).toBe(true);
  });
});
