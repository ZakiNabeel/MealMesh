# MealMesh — Project Context for Claude Code

> Put this file in the project root. Claude Code reads it automatically on every session.
> It is the source of truth for what we are building and how. Keep it updated as decisions change.

---

## 1. What we are building

**MealMesh** is a subscription app that generates ONE weekly meal plan for a whole household where members have **different dietary needs**, plus a single consolidated grocery list.

The core problem: most meal apps are built for a solo dieter. Real households mix constraints — one person is halal, another gluten-free, a kid is picky, someone is diabetic. MealMesh merges all member profiles into a plan that works for everyone at once.

**This multi-profile constraint-merging is the entire product. It is the moat. Prioritize it over everything else.**

**One-line pitch:** One household. Many diets. One plan. One grocery list.

---

## 2. Tech stack (do not deviate without asking)

| Layer | Choice | Notes |
|---|---|---|
| App framework | **Expo + React Native (TypeScript)** | ONE codebase → iOS, Android, AND web. This is non-negotiable — it's why we can ship all platforms. |
| Routing | **Expo Router** | File-based routing; gives web build for free. |
| Language | **TypeScript** | Strict mode. Dietary logic must be type-safe — a wrong type here is a user safety bug. |
| Backend / DB / Auth | **Supabase** | Postgres + Auth + Row Level Security. |
| AI engine | **Google Gemini API (free tier)** | Model: `gemini-2.5-flash` for plan generation, called over plain REST from the Edge Function (no SDK). Free tier has a small, account-specific daily request quota that changes without notice — check the real number for your key at aistudio.google.com. The `plan_cache` table (see §3) is what keeps real usage well under that quota: most repeat/shared constraint profiles are served from cache, not a fresh call. NEVER call the API directly from the client — proxy through a Supabase Edge Function so the API key stays secret. Note: Gemini's free tier terms allow Google to use prompts/outputs to improve their products (the paid tier opts out of this); since only dietary-constraint data and no real names are sent (see §4), this is an acceptable trade for $0 cost, but it's a real difference from a paid LLM API and worth revisiting if the data sent ever expands. |
| Web subscriptions | **Freemius** (Merchant of Record) | Founder is in Pakistan; Freemius handles payments + payouts via Payoneer/wire. Web/PWA is the FIRST launch surface. |
| Mobile subscriptions | **RevenueCat** (later) | Wraps App Store + Play billing. Added after web launch once store accounts are funded. |
| Hosting (web) | **Vercel** or Expo hosting | Deploy the web/PWA build. |
| Analytics | **Mixpanel** | Track: signup, onboarding_complete, plan_generated, paywall_viewed, subscribed. |

**Launch order:** Web/PWA + Freemius FIRST (July 1, $0 cost). Mobile apps + RevenueCat follow once revenue funds the Apple ($99/yr) and Google ($25) developer accounts.

---

## 3. Core data model (Supabase tables)

```
households
  id (uuid, pk)
  owner_user_id (uuid, fk -> auth.users)
  name (text)
  region_preference (text)        -- e.g. 'south_asian','middle_eastern','mediterranean','east_asian','latin','african','none'
  created_at (timestamptz)

members
  id (uuid, pk)
  household_id (uuid, fk -> households)
  name (text)
  age_band (text)                 -- 'child','teen','adult'
  calorie_target (int, nullable)

member_constraints
  id (uuid, pk)
  member_id (uuid, fk -> members)
  constraint_key (text)           -- e.g. 'halal','gluten_free','vegan','nut_allergy','diabetic'
  type (text)                     -- 'religious' | 'lifestyle' | 'medical' | 'allergen'
  severity (text)                 -- 'hard' (never violate) | 'soft' (prefer to avoid)

meal_plans
  id (uuid, pk)
  household_id (uuid, fk -> households)
  week_start (date)
  plan_json (jsonb)               -- the 7-day plan
  grocery_json (jsonb)            -- consolidated grocery list
  created_at (timestamptz)

subscription_status
  user_id (uuid, pk, fk -> auth.users)
  tier (text)                     -- 'free' | 'pro'
  source (text)                   -- 'freemius' | 'revenuecat'
  current_period_end (timestamptz)
```

Enable Row Level Security on every table. A user can only read/write rows tied to their own `auth.uid()`.

**Critical:** the multi-profile model must exist from day one. Do NOT build a single-user model and retrofit households later — it can't be cleanly retrofitted.

---

## 4. The constraint engine (the moat — get this right)

### Full constraint library to support
Group these in the UI under headers. Store each as a row in `member_constraints`.

- **Religious / cultural:** halal, kosher, hindu_vegetarian, jain, buddhist, sikh, rastafarian_ital, sda, lds, orthodox_lenten
- **Lifestyle:** vegetarian, vegan, pescatarian, flexitarian, raw_food, pollotarian
- **Medical:** diabetic, gluten_free, low_fodmap, renal, low_sodium_cardiac, keto, paleo, whole30, mediterranean, autoimmune_aip, prenatal
- **Allergens (always HARD severity):** dairy, eggs, peanuts, tree_nuts, soy, wheat, fish, shellfish, sesame, lactose, nightshades, sulfites, mustard, corn, caffeine

### How the engine must work (this is the key insight)
Generic AI meal planners FAIL because they send only NEGATIVE rules ("no pork, no alcohol") and the model guesses unsafe substitutes. We avoid this:

1. For a household, compute:
   - `HARD_EXCLUDE` = union of all allergens + all religious "haram/forbidden" ingredients across ALL members (severity = hard).
   - `SOFT_AVOID` = union of soft preferences.
   - `ALLOW_LIST` = explicit allowed proteins / grains / oils derived from the active constraints (POSITIVE guidance, not just exclusions).
2. Send ALL THREE to Gemini as structured JSON, not raw user text — and never the member's real name (the output schema never needs it; see `member: "member_1"` below).
3. After Gemini responds, run a **deterministic safety-validation pass** in code: reject/regenerate any meal whose ingredients intersect `HARD_EXCLUDE`. Never show a plan that fails this check.

This positive-allow-list + post-validation is what competitors can't easily copy. Treat it as the product's core IP — and it's provider-agnostic: the safety guarantee comes from our own code, not from which LLM generated the plan.

### AI call shape (proxy via Supabase Edge Function)
```ts
// pseudocode — runs server-side in a Supabase Edge Function
async function generatePlan(household) {
  const { members } = household;
  const HARD_EXCLUDE = unionHardExclusions(members);   // allergens + forbidden
  const SOFT_AVOID   = unionSoftAvoid(members);
  const ALLOW        = deriveAllowList(members, household.region_preference);

  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You are a culturally-aware household meal planner. You MUST respect halal, kosher, and all medical/allergen rules exactly. Use ONLY ingredients consistent with the ALLOW list and never any item in HARD_EXCLUDE. Return ONLY valid JSON, no prose." }] },
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8000 },
      contents: [{
        role: "user",
        parts: [{ text: JSON.stringify({
          members: members.map((m, i) => ({ member: `member_${i + 1}`, constraints: m.constraints })),  // no real names sent
          HARD_EXCLUDE, SOFT_AVOID, ALLOW,
          region: household.region_preference,
          days: 7,
          format: "{days:[{dayOfWeek, meal, sharedOrVariant, ingredients:[...], satisfies:[...]}], grocery:[...]}"
        }) }]
      }]
    })
  });

  const plan = safeParseJSON(resp);              // strip code fences, parse
  const validated = rejectViolations(plan, HARD_EXCLUDE);  // deterministic safety pass
  return validated;
}
```

---

## 5. Screens to build (match the prototype)

The clickable prototype already defines the UX. Build these in order:

1. **Auth** — email magic link via Supabase. Keep it one tap.
2. **Onboarding / household setup** — add members (name + avatar initial), tap diet chips per member, set region preference. This is Step 1 of 2.
3. **Plan generation** — "Generate this week's plan" button → loading state → result.
4. **Weekly plan view** — 7 day cards. Each shows: day, meal name, a badge ("One shared dish" / "Simple variations"), and check-tags showing which constraints it satisfies.
5. **Grocery list view** — one consolidated, checkable list for the week. Tab-switch with the plan view.
6. **Paywall** — free tier hits a wall after a few plans; Pro unlocks unlimited + all profiles. Wire to Freemius on web.
7. **Settings** — manage household, members, subscription status.

---

## 6. Subscription tiers

| Tier | Price | Includes |
|---|---|---|
| Free | $0 | 1 member profile, 3 AI plans/week, basic grocery list |
| Pro | **$9.99/mo or $99.90/yr** | Unlimited plans, unlimited member profiles, full week, all 40+ diets, regional cuisines, grocery export |

Enable Freemius regional/PPP pricing so price-sensitive markets (India, Pakistan, Indonesia, Nigeria) see locally affordable prices.

Gate logic: check `subscription_status.tier` server-side before generating a 4th plan in a week or adding a 2nd member.

---

## 7. Coding conventions

- TypeScript strict mode on. No `any` in the constraint engine.
- All Claude API calls go through Supabase Edge Functions. The API key is NEVER in client code or the repo.
- Keep secrets in environment variables (`.env`, never committed). Provide a `.env.example`.
- Components: functional + hooks. Keep screens thin; put logic in `/lib`.
- Folder structure:
  ```
  /app            (Expo Router screens)
  /components     (reusable UI)
  /lib            (constraint engine, api clients, supabase client)
  /lib/constraints.ts   (the HARD_EXCLUDE / ALLOW logic + the diet library)
  /supabase/functions   (edge functions, incl. the Claude proxy)
  /types          (shared TS types)
  ```
- Write the `constraints.ts` library and its types FIRST. Everything depends on it.

---

## 8. Build order (priority for Claude Code)

1. Scaffold Expo + TypeScript + Expo Router project; confirm it runs on web.
2. Set up Supabase client + the data model (migrations) + RLS.
3. Build `/lib/constraints.ts`: the full diet library, types, and the HARD_EXCLUDE / ALLOW / validation functions. Add unit tests for the safety-validation pass.
4. Build the Supabase Edge Function that proxies Claude and returns a validated plan.
5. Build screens in the order listed in section 5.
6. Wire Freemius checkout + the paywall gate.
7. Ship the web/PWA build to Vercel.

---

## 9. Definition of done for v1 (July 1 web launch)

- A user can sign up, create a household with 2+ members who have DIFFERENT diets, generate a 7-day plan that provably respects every hard constraint, and see a grocery list.
- The safety-validation pass is in place and tested — no plan ever shows a forbidden ingredient.
- Free vs Pro gating works; Freemius checkout completes and unlocks Pro.
- Runs as an installable PWA on phone and laptop browsers.

---

## 10. Non-negotiables (safety)

- A meal plan must NEVER include an ingredient in any member's hard-exclude set (allergens, religious prohibitions). This is a safety guarantee, not a preference. The deterministic validation pass enforces it — do not rely on the model alone.
- Never expose the Anthropic API key client-side.
- Never log users' full health/dietary data to analytics — track events, not personal constraint contents.
