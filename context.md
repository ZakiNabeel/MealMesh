# MealMesh — Build Context (progress so far)

> Working status document. The **product** source of truth is
> [docs/MealMesh-context.md](docs/MealMesh-context.md); this file tracks **what
> has actually been built**, what's verified, and what's next.
>
> Last updated: 2026-06-24

---

## 1. Snapshot

MealMesh generates **one** weekly meal plan for a whole household whose members
have **different** dietary needs, plus a single consolidated grocery list. The
multi-profile constraint-merging engine is the moat and has been built first.

**Stack:** Expo SDK 56 · React Native 0.85 · React 19 · Expo Router (file-based)
· TypeScript (strict) · Supabase (Postgres + Auth + RLS) · Anthropic Claude
(via Edge Function) · web/PWA-first launch.

**Health:** `npm run typecheck` ✅ green · `npm test` ✅ 16/16 · web build
(`expo export --platform web`) ✅ compiles.

---

## 2. What's done

### Build step 1 — Scaffold ✅
- Expo default template (TS + Expo Router, typed routes, React Compiler on).
- Path alias `@/*` → `src/*`. One codebase → iOS / Android / web.
- Renamed identity to MealMesh ([app.json](app.json), [package.json](package.json)).
- Web build verified to compile.

### Build step 2 — Backend foundation ✅
- [src/lib/supabase.ts](src/lib/supabase.ts) — anon-key client. Web vs. native
  session handling (`detectSessionInUrl` on web), AsyncStorage persistence,
  boots safely with placeholders before `.env` is filled
  (`isSupabaseConfigured` flag).
- [.env.example](.env.example) — client-safe `EXPO_PUBLIC_*` vars separated from
  server-only secrets (which live in Edge Function secrets, never the repo).
- [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) —
  the 5 tables (`households`, `members`, `member_constraints`, `meal_plans`,
  `subscription_status`), **RLS enabled on all** (owner-only via `auth.uid()`),
  enum CHECKs mirroring the TS unions, indexes for the ownership lookups, and a
  signup trigger that auto-creates a `free` subscription row.

### Build step 3 — Constraint engine (the moat) ✅
Pure, deterministic, dependency-free, `any`-free TypeScript.
- [src/types/index.ts](src/types/index.ts) — domain model: `Member`,
  `Household`, `MemberConstraint`, a **closed `Token` vocabulary**, plan +
  validation shapes. A closed union (not `string`) so the compiler catches a
  typo that would otherwise be a silent safety hole.
- [src/lib/dietLibrary.ts](src/lib/dietLibrary.ts) — the data:
  - `DIET_DEFINITIONS` — all **42 constraints** (religious, lifestyle, medical,
    allergen) and the tokens each forbids.
  - `STAPLES` + `REGIONS` — positive pantry with cuisine affinity.
  - `INGREDIENT_LEXICON` + `LEXICON_OVERRIDES` — keyword→token map; the safety
    net that detects forbidden ingredients in free-text model output.
- [src/lib/constraints.ts](src/lib/constraints.ts) — the engine:
  - `unionHardExclusions` / `unionSoftAvoid` — merge constraints across members.
  - `deriveAllowList` — POSITIVE pantry (proteins/grains/oils/…), plus a
    `universal` list safe for every member (basis for shared dishes).
  - `analyzeIngredient` — over-detection biased (a false positive only forces a
    regenerate; a false negative could be unsafe).
  - `validatePlan` — the **deterministic safety pass**: removes any meal whose
    ingredients intersect HARD_EXCLUDE, plus the kosher meat+dairy rule.
- [src/lib/constraints.test.ts](src/lib/constraints.test.ts) — 16 tests,
  including the §10 invariant: *no meal in a safe plan ever intersects
  HARD_EXCLUDE*. Edge cases covered: soy sauce hides wheat/gluten, almond milk
  isn't dairy, black vs. bell pepper, high-mercury fish (prenatal), allergens
  forced to `hard`.

### Design decisions
- **Visual style:** cool slate + indigo accent — `#FFFFFF` bg · `#0F172A` text
  · `#4F46E5` accent. Set in [src/constants/theme.ts](src/constants/theme.ts)
  (light + dark, slate neutrals, semantic colors, radius scale).
- **Mobile-first, minimalist.** `MaxContentWidth` constrains the web build so it
  reads like the app.

---

## 3. Project layout (current)

```
src/
  app/            Expo Router screens (template example — to be replaced)
  components/     template UI primitives (themed-text/view, tabs, …)
  constants/
    theme.ts      design tokens (slate + indigo)
  lib/
    constraints.ts      ← engine: HARD/SOFT/ALLOW + validatePlan
    constraints.test.ts ← safety tests (npm test)
    dietLibrary.ts      ← diets, staples, ingredient lexicon
    supabase.ts         ← anon-key client
  types/
    index.ts            ← domain + plan + validation types
supabase/
  migrations/
    0001_init.sql       ← schema + RLS + signup trigger
docs/
  MealMesh-context.md   ← product source of truth
.env.example
CLAUDE.md               ← points Claude to the context doc + conventions
```

---

## 4. Verify locally

```bash
npm install
npm run typecheck     # tsc --noEmit — clean
npm test              # jest — 16/16
npx expo start --web  # run the app in a browser
```

---

## 5. Blocked on the user (as of 2026-06-24)

1. **Clickable prototype** (Figma link / screenshots) — gates the screens
   (build step 5). User will share it.
2. **Supabase** — Project URL + anon key (→ `.env`), and run
   `0001_init.sql` in the SQL Editor.
3. **Anthropic API key** — set as `ANTHROPIC_API_KEY` in Supabase Edge Function
   secrets (never client-side / never committed).
4. *Later:* Freemius (paywall) + Mixpanel (analytics) credentials.

---

## 6. Next steps

| Step | Needs | Work |
|---|---|---|
| 4. Claude proxy Edge Function | Supabase + Anthropic key | `supabase/functions/generate-plan`: shape HARD_EXCLUDE/SOFT_AVOID/ALLOW, call Claude, run `validatePlan`, persist. Decide engine code-sharing between the RN app and the Deno function (likely relocate the pure engine to a `_shared` path importable by both). |
| 5. Screens | Prototype | Auth (magic link) → onboarding/household → plan generation → weekly plan → grocery → paywall → settings. Mobile-first, minimalist. Mock data until the Edge Function is live. |
| 6. Paywall | Freemius keys | Free vs. Pro gating (server-checked) + Freemius checkout. |
| 7. Ship | — | Deploy web/PWA build to Vercel/Expo hosting. |
