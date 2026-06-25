/**
 * Tests for the constraint engine — with emphasis on the deterministic safety
 * pass (context doc §10: a plan must NEVER include a hard-excluded ingredient).
 */

import {
  analyzeIngredient,
  deriveAllowList,
  makeConstraint,
  unionHardExclusions,
  unionSoftAvoid,
  validatePlan,
} from '@/lib/constraints';
import type {
  ConstraintKey,
  MealPlan,
  Member,
  PlannedMeal,
  Severity,
  Token,
} from '@/types';

/* ---------- helpers ---------- */

let seq = 0;
function member(name: string, keys: Array<ConstraintKey | [ConstraintKey, Severity]>): Member {
  return {
    id: `m${seq++}`,
    name,
    ageBand: 'adult',
    calorieTarget: null,
    constraints: keys.map((k) =>
      Array.isArray(k) ? makeConstraint(k[0], k[1]) : makeConstraint(k),
    ),
  };
}

function meal(name: string, ingredients: string[]): PlannedMeal {
  return {
    dayOfWeek: 'monday',
    slot: 'dinner',
    name,
    sharedOrVariant: 'shared',
    ingredients,
    satisfies: [],
  };
}

function plan(meals: PlannedMeal[]): MealPlan {
  return { days: meals, grocery: [] };
}

/* ---------- ingredient analysis ---------- */

describe('analyzeIngredient', () => {
  const has = (s: string, t: Token) => analyzeIngredient(s).has(t);

  it('detects hidden allergens in compound ingredients', () => {
    // soy sauce famously also contains wheat/gluten
    const soy = analyzeIngredient('soy sauce');
    expect(soy.has('soy')).toBe(true);
    expect(soy.has('wheat')).toBe(true);
    expect(soy.has('gluten')).toBe(true);
  });

  it('does NOT flag plant milks as dairy', () => {
    expect(has('almond milk', 'tree_nuts')).toBe(true);
    expect(has('almond milk', 'dairy')).toBe(false);
    expect(has('soy milk', 'soy')).toBe(true);
    expect(has('soy milk', 'dairy')).toBe(false);
  });

  it('flags real dairy', () => {
    expect(has('grated parmesan cheese', 'dairy')).toBe(true);
    expect(has('plain greek yogurt', 'lactose')).toBe(true);
  });

  it('distinguishes black pepper (safe) from bell pepper (nightshade)', () => {
    expect(has('black pepper', 'nightshades')).toBe(false);
    expect(has('red bell pepper', 'nightshades')).toBe(true);
  });

  it('detects pork across cured-meat synonyms', () => {
    expect(has('smoked bacon', 'pork')).toBe(true);
    expect(has('prosciutto', 'pork')).toBe(true);
    expect(has('pepperoni', 'pork')).toBe(true);
  });

  it('flags high-mercury fish for prenatal safety', () => {
    expect(has('seared tuna steak', 'high_mercury_fish')).toBe(true);
    expect(has('grilled salmon', 'high_mercury_fish')).toBe(false);
  });
});

/* ---------- exclusion unions ---------- */

describe('unionHardExclusions', () => {
  it('merges hard exclusions across members with different diets', () => {
    const household = [
      member('Amir', ['halal']),
      member('Lena', ['peanuts']),
      member('Sam', ['gluten_free']),
    ];
    const hard = new Set(unionHardExclusions(household));
    expect(hard.has('pork')).toBe(true); // halal
    expect(hard.has('alcohol')).toBe(true); // halal
    expect(hard.has('peanuts')).toBe(true); // allergy
    expect(hard.has('gluten')).toBe(true); // gluten_free
  });

  it('keeps soft preferences out of the hard set, and de-dupes', () => {
    const household = [member('Dee', ['diabetic', 'mediterranean'])];
    const hard = unionHardExclusions(household);
    expect(hard).toHaveLength(0); // both are soft by default
    expect(new Set(unionSoftAvoid(household)).has('added_sugar')).toBe(true);
  });

  it('forces allergens to hard even if a soft override is attempted', () => {
    const household = [member('Kim', [['peanuts', 'soft']])];
    expect(new Set(unionHardExclusions(household)).has('peanuts')).toBe(true);
  });
});

/* ---------- ALLOW list ---------- */

describe('deriveAllowList', () => {
  it('removes animal/dairy/egg staples for a vegan household but keeps plant proteins', () => {
    const allow = deriveAllowList([member('V', ['vegan'])], 'none');
    expect(allow.proteins).toContain('tofu');
    expect(allow.legumes).toContain('lentils');
    expect(allow.proteins).not.toContain('chicken');
    expect(allow.proteins).not.toContain('eggs');
    expect(allow.proteins).not.toContain('paneer'); // dairy
  });

  it('produces a universal list safe for every member', () => {
    const allow = deriveAllowList(
      [member('A', ['vegan']), member('B', ['gluten_free'])],
      'none',
    );
    // universal must contain no animal, dairy, egg, or gluten staples
    for (const name of allow.universal) {
      const tokens = analyzeIngredient(name);
      for (const bad of ['animal_flesh', 'dairy', 'eggs', 'gluten'] as Token[]) {
        expect(tokens.has(bad)).toBe(false);
      }
    }
    expect(allow.universal.length).toBeGreaterThan(0);
  });

  it('prioritizes region-appropriate staples first', () => {
    const allow = deriveAllowList([member('A', [])], 'south_asian');
    // lentils carry a south_asian affinity and should rank ahead of black beans
    expect(allow.legumes.indexOf('lentils')).toBeLessThan(allow.legumes.indexOf('black beans'));
  });
});

/* ---------- the safety pass (the non-negotiable) ---------- */

describe('validatePlan — deterministic safety pass', () => {
  it('rejects a meal containing a hard-excluded ingredient and removes it', () => {
    const household = [member('Amir', ['halal'])];
    const hard = unionHardExclusions(household);
    const result = validatePlan(
      plan([
        meal('Chicken rice bowl', ['chicken', 'white rice', 'broccoli']),
        meal('Pork stir fry', ['pork', 'soy sauce', 'bell pepper']),
      ]),
      hard,
      household,
    );
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.token === 'pork')).toBe(true);
    expect(result.safePlan.days.map((d) => d.name)).toEqual(['Chicken rice bowl']);
  });

  it('passes a fully-compliant plan', () => {
    const household = [member('Amir', ['halal']), member('Sam', ['gluten_free'])];
    const hard = unionHardExclusions(household);
    const result = validatePlan(
      plan([meal('Grilled chicken & rice', ['chicken', 'brown rice', 'spinach', 'olive oil'])]),
      hard,
      household,
    );
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('enforces the kosher meat-and-dairy separation per meal', () => {
    const household = [member('Rivka', ['kosher'])];
    const hard = unionHardExclusions(household);

    const mixed = validatePlan(
      plan([meal('Cheeseburger', ['beef', 'cheddar cheese', 'whole wheat bread'])]),
      hard,
      household,
    );
    expect(mixed.ok).toBe(false);
    expect(mixed.violations.some((v) => v.token === 'meat_dairy_mix')).toBe(true);

    // fish is parve — salmon + cheese is fine
    const parve = validatePlan(
      plan([meal('Salmon gratin', ['salmon', 'cream', 'spinach'])]),
      hard,
      household,
    );
    expect(parve.violations.some((v) => v.token === 'meat_dairy_mix')).toBe(false);
  });

  it('INVARIANT: no meal in safePlan ever intersects HARD_EXCLUDE', () => {
    // Stress household: halal + peanut allergy + gluten-free + vegan
    const household = [
      member('Amir', ['halal']),
      member('Lena', ['peanuts']),
      member('Sam', ['gluten_free']),
      member('Vee', ['vegan']),
    ];
    const hard = unionHardExclusions(household);
    const hardSet = new Set(hard);

    const dirty = plan([
      meal('Beef pasta', ['beef', 'pasta', 'parmesan cheese']),
      meal('Peanut noodles', ['rice noodles', 'peanut butter', 'tofu']),
      meal('Veggie stir fry', ['tofu', 'broccoli', 'soy sauce']), // soy sauce => wheat/gluten
      meal('Lentil curry', ['lentils', 'spinach', 'coconut milk', 'brown rice']), // clean
    ]);

    const result = validatePlan(dirty, hard, household);
    expect(result.ok).toBe(false);

    // The core safety guarantee: nothing forbidden survives.
    for (const m of result.safePlan.days) {
      for (const ingredient of m.ingredients) {
        for (const token of analyzeIngredient(ingredient)) {
          expect(hardSet.has(token)).toBe(false);
        }
      }
    }
    // The one clean meal should survive.
    expect(result.safePlan.days.map((d) => d.name)).toContain('Lentil curry');
  });
});
