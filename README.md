# MealMesh

**One household. Many diets. One plan. One grocery list.**

MealMesh generates a single weekly meal plan for a whole household whose members
have **different dietary needs** (halal, gluten-free, vegan, nut allergy,
diabetic, …), plus one consolidated grocery list. The multi-profile
constraint-merging engine is the product and the moat.

## How it works

1. **Onboard** a household — add members, tap each person's diets/allergens,
   pick a regional cuisine.
2. The **constraint engine** ([src/lib/constraints.ts](src/lib/constraints.ts))
   merges every member into `HARD_EXCLUDE` (never allowed — safety),
   `SOFT_AVOID`, and a positive `ALLOW` pantry.
3. A **Supabase Edge Function** ([supabase/functions/generate-plan](supabase/functions/generate-plan))
   sends that structured data to **Claude** (`claude-haiku-4-5`) and gets back a
   7-day plan with recipes.
4. A **deterministic safety pass** re-validates every meal in code — a plan that
   contains any member's hard-excluded ingredient is never shown.

## Tech stack

- **Expo + React Native (TypeScript)** — one codebase → iOS, Android, web/PWA
- **Expo Router** — file-based routing, SPA web output
- **Supabase** — Postgres + Auth (magic link + Google) + Row Level Security
- **Anthropic Claude API** — plan generation, proxied server-side (key never ships to the client)

## Run locally

```bash
npm install
cp .env.example .env      # fill in your Supabase URL + anon key
npm run web               # http://localhost:8081
npm test                  # constraint-engine safety tests
npm run typecheck
```

## Deploy (web)

The web build is a static SPA exported with `npm run build` (→ `dist/`) and
deployed on Vercel. Set `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` as Vercel environment variables.

The Edge Function is deployed separately:

```bash
supabase functions deploy generate-plan
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # server-only secret
```

## Safety is non-negotiable

A meal plan must **never** include an ingredient in any member's hard-exclude
set (allergens, religious prohibitions). This is enforced deterministically in
code, not left to the model. See [docs/MealMesh-context.md](docs/MealMesh-context.md)
for the full product spec.
