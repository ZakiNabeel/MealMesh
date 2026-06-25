# MealMesh

One household. Many diets. One plan. One grocery list.

A subscription app that generates ONE weekly meal plan for a whole household
whose members have **different dietary needs**, plus a single consolidated
grocery list. The multi-profile constraint-merging engine is the product and
the moat — prioritize it over everything else.

## Source of truth

@docs/MealMesh-context.md

That document defines what we are building, the tech stack, the data model, the
constraint engine, screens, pricing, and the build order. Read it before making
product decisions. Keep it updated as decisions change.

## Toolchain note

@AGENTS.md

## Project-specific conventions (in addition to the context doc)

- **Mobile-first, minimalist UI.** The primary market is mobile; design for a
  narrow viewport first and keep the visual language clean and uncluttered.
- Source lives under `src/` (the Expo "default" template layout). The context
  doc's folder names map as: `src/app` (routes), `src/components`,
  `src/lib` (incl. `src/lib/constraints.ts`), `src/types`. Edge functions live
  at repo root under `supabase/functions`. Path alias: `@/*` → `src/*`.
- The constraint engine is pure, dependency-free, `any`-free TypeScript:
  - `src/types/index.ts` — domain + plan + validation types.
  - `src/lib/dietLibrary.ts` — diet definitions, staple pantry, ingredient lexicon.
  - `src/lib/constraints.ts` — HARD_EXCLUDE / SOFT_AVOID / ALLOW derivation +
    the deterministic `validatePlan` safety pass.
  - `src/lib/constraints.test.ts` — safety tests. Run with `npm test`.
- `npm run typecheck` (tsc) and `npm test` (jest) must both stay green.
