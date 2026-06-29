/**
 * Edge Function: proxies the Gemini API to generate a household's weekly meal
 * plan. The Gemini API key lives only in this function's secrets — it is
 * never sent to or readable by the client. We call Gemini over plain REST
 * (no SDK) so there's no extra npm dependency to resolve in the Deno runtime.
 *
 * Mirrors docs/MealMesh-context.md §4: HARD_EXCLUDE / SOFT_AVOID / ALLOW are
 * derived by the SAME constraint engine the app uses (imported straight from
 * src/lib, see ./deno.json for the path-alias mapping), sent to Gemini as
 * structured JSON (never raw user text — member names are stripped too, see
 * `requestPlan`, since the output schema never needs them), and the response
 * is run back through the engine's deterministic `validatePlan` safety pass
 * before it ever reaches a client. If a violation slips through, we ask
 * Gemini to fix it once more; if it still fails, we return the
 * engine-scrubbed safe plan rather than an unsafe one.
 *
 * CACHING: two households with an identical merged constraint profile (same
 * HARD_EXCLUDE/SOFT_AVOID/ALLOW/region/budget/currency — member names don't
 * affect what Gemini generates) reuse one validated plan from `plan_cache`
 * instead of paying for a second Gemini call. A first-time generation
 * (`seed === 0`) checks the cache first; an explicit regenerate (`seed > 0`)
 * always calls Gemini fresh and refreshes the cache entry, so repeat
 * regenerate requests for the same profile still see fresh variety over time.
 * This caching matters even more here than it did with Claude: Gemini's free
 * tier has a small, account-specific daily request quota (see
 * docs/MealMesh-context.md §2), so reusing cached plans for repeat/shared
 * constraint profiles is what keeps the app inside that quota.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.74.0';

import { COUNTRIES } from '../../../src/lib/countries.ts';
import { deriveAllowList, unionHardExclusions, unionSoftAvoid, validatePlan } from '../../../src/lib/constraints.ts';
import { normalizeCuisineMix, regionsInMix } from '../../../src/lib/cuisineMix.ts';
import type { Household, MealPlan } from '../../../src/types/index.ts';

/** Country label for a code (e.g. 'PK' -> 'Pakistan') — used only to phrase
 *  the cuisine-disambiguation note to Gemini, never sent as PII. */
function countryLabel(code: string | undefined): string | null {
  return COUNTRIES.find((c) => c.code === code)?.label ?? null;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
// Configurable without a redeploy in case a newer/cheaper free-tier model
// shows up — check what your key gets in https://aistudio.google.com/.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Service-role client for the shared, content-addressable plan cache — RLS
// has no policies for it, so only this (server-side, bypasses RLS) client
// can read/write it. Separate from the per-request anon+user-JWT client used
// below for the auth check.
const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

async function constraintHash(household: Household, hardExclude: string[], softAvoid: string[], allow: ReturnType<typeof deriveAllowList>): Promise<string> {
  const cuisineMix = normalizeCuisineMix(household.region, household.cuisines);
  const canonical = {
    hardExclude: [...hardExclude].sort(),
    softAvoid: [...softAvoid].sort(),
    allow: Object.fromEntries(Object.entries(allow).map(([k, v]) => [k, [...(v as string[])].sort()])),
    cuisineMix: cuisineMix.map((c) => `${c.region}:${c.percent}`).sort(),
    country: household.country ?? null,
    budgetWeekly: household.budgetWeekly ?? null,
    currency: household.currency ?? null,
    healthConsciousness: household.healthConsciousness ?? 3,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SYSTEM_PROMPT =
  'You are a culturally-aware household meal planner. You MUST respect halal, kosher, ' +
  'and all medical/allergen rules exactly. Use ONLY ingredients consistent with the ALLOW ' +
  'list and never any item in HARD_EXCLUDE.\n' +
  'MEALS: Produce FIVE meals for EACH of the 7 days — slot must be one of ' +
  '"breakfast","lunch","supper","dinner","dessert" (35 entries total). Breakfasts should be ' +
  'breakfast-appropriate for the region (e.g. south_asian: anda paratha, chana, halwa puri).\n' +
  'SUPPER is the LIGHT evening tea-time snack that pairs with chai/tea or coffee — small and ' +
  'quick, NOT a second full dinner. Examples: south_asian: pakoray, samosa, chana chaat, masala ' +
  'toast, aloo tikki, dahi bhalla, biscuits/rusk; western: a cheese toastie, savoury muffin, ' +
  'scone, dip with crackers. Keep supper simple and small. "lunch" and "dinner" are the full meals.\n' +
  'DESSERT is a small, fruit/grain/dairy-based sweet — NEVER built around the day\'s protein. Keep ' +
  'it simple (a fruit dish, pudding, or regional sweet like kheer/halwa) and culturally appropriate ' +
  'to the region.\n' +
  'HEALTH_CONSCIOUSNESS (1-5, where 1 = no particular focus and 5 = extremely health-conscious, e.g. ' +
  'gym-goers tracking macros): as this rises, progressively reduce added sugar/oil/ghee/butter and fried ' +
  'preparations, prefer grilling/baking/steaming over deep-frying, lean on leaner proteins (fish, chicken, ' +
  'legumes, egg whites) over fatty cuts, favor fruit-forward desserts over syrup-heavy sweets, and add more ' +
  'vegetables/fiber per meal. At 1-2, cook normally with no special restriction. Never violate HARD_EXCLUDE ' +
  'or SOFT_AVOID to satisfy this — it only adjusts technique and proportions within what is already allowed.\n' +
  'CUISINE: `cuisineMix` is a list of {region, percent} that sums to 100 — distribute the 35 ' +
  'meals across them proportionally (e.g. 80/20 means roughly 28 of the 35 meals draw from the ' +
  'first region\'s dishes, 7 from the second\'s), spread naturally through the week rather than ' +
  'grouped into a block at the start or end. Every meal\'s `cuisine` field must name the specific ' +
  'region it was drawn from. For each region, use authentic, named dishes of THAT cuisine (e.g. ' +
  'south_asian: karahi, biryani, daal, pulao, sabzi, qeema — not generic "traybake" or "stir-fry"); ' +
  'use that cuisine\'s real spices and techniques.\n' +
  'COUNTRY DISAMBIGUATION: when `country` is given, a broad region label must read as THAT ' +
  'country\'s specific home cooking, not the wider region\'s stereotype — these are not ' +
  'interchangeable even within the same region. For Pakistan specifically: use Pakistani dishes ' +
  '(karahi, biryani, nihari, haleem, daal chawal, paratha, qeema, chapli kebab, seekh kebab) and ' +
  'avoid dishes that read as distinctly Indian rather than Pakistani (e.g. dosa, idli, sambar, ' +
  'vada, paneer-heavy Punjabi-Indian restaurant fare) unless a member\'s constraints specifically ' +
  'call for them. Apply the same country-specific judgment for any other country given.\n' +
  'RECIPES: For every meal include a `recipe` with `servings` (number), `timeMinutes` ' +
  '(number), and `steps` (3–5 short numbered instructions a home cook can follow — keep each ' +
  'step under 12 words), plus a `cuisine` label string.\n' +
  'BUDGET: If `budgetWeekly` (in the local `currency`) is given, choose affordable, in-season, ' +
  'locally-common ingredients so the whole week fits roughly within that budget — lean on ' +
  'legumes, eggs and cheaper cuts before premium proteins.\n' +
  'GROCERY: `quantity` must be a realistic total shopping amount for the WHOLE household for the ' +
  'WHOLE week, with a real unit (e.g. "1.5 kg", "500 g", "1 dozen", "2 L", "250 ml", "6 pcs") — ' +
  'never an occurrence count like "x3".\n' +
  'Return ONLY valid JSON, no prose, no markdown code fences.';

function safeParseJSON(text: string): unknown {
  const stripped = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(stripped);
}

function isMealPlan(value: unknown): value is MealPlan {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.days) && Array.isArray(v.grocery);
}

async function requestPlan(household: Household, retryNote?: string, attempt = 1): Promise<MealPlan> {
  const hardExclude = unionHardExclusions(household.members);
  const softAvoid = unionSoftAvoid(household.members);
  const cuisineMix = normalizeCuisineMix(household.region, household.cuisines);
  const allow = deriveAllowList(household.members, regionsInMix(cuisineMix));

  const payload = {
    // Anonymized on purpose — the output schema (below) never references a
    // member by name, only by constraint, so the model never needs real
    // names to do its job. One less thing leaving the building.
    members: household.members.map((m, i) => ({ member: `member_${i + 1}`, constraints: m.constraints })),
    HARD_EXCLUDE: hardExclude,
    SOFT_AVOID: softAvoid,
    ALLOW: allow,
    cuisineMix,
    country: household.country ?? null,
    countryName: countryLabel(household.country),
    budgetWeekly: household.budgetWeekly ?? null,
    currency: household.currency ?? null,
    // 1 (not health-conscious) - 5 (extremely, e.g. gym-goers tracking
    // macros) — see HEALTH_CONSCIOUSNESS note in SYSTEM_PROMPT.
    healthConsciousness: household.healthConsciousness ?? 3,
    days: 7,
    mealsPerDay: ['breakfast', 'lunch', 'supper', 'dinner', 'dessert'],
    format:
      '{"days":[{"dayOfWeek":"monday".."sunday","slot":"breakfast"|"lunch"|"supper"|"dinner"|"dessert",' +
      '"name":string,"sharedOrVariant":"shared"|"variant","ingredients":string[],"satisfies":string[],' +
      '"cuisine":string,"recipe":{"servings":number,"timeMinutes":number,"steps":string[]}}],' +
      '"grocery":[{"name":string,"category":string,"quantity":string}]}',
    ...(retryNote ? { correction: retryNote } : {}),
  };

  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      // 35 meals × a short recipe each, plus a grocery list, is a lot of
      // output — and gemini-2.5-flash spends part of maxOutputTokens on
      // internal "thinking" by default, which was eating the whole budget
      // and truncating the JSON before any content came out (finishReason
      // MAX_TOKENS on every attempt). Disabling thinking and raising the
      // ceiling fixes both the truncation and the multi-minute hang.
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 24000,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini request failed (${resp.status}): ${errText}`);
  }

  const body = (await resp.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const finishReason = body.candidates?.[0]?.finishReason;
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');

  // Gemini occasionally returns a response cut short (hit an internal length
  // limit before finishing the JSON) or, more rarely, malformed JSON despite
  // responseMimeType. Both surface as a broken parse — retry the generation
  // once before giving up, since a fresh call is usually clean.
  let parsed: unknown;
  try {
    if (finishReason && finishReason !== 'STOP') throw new Error(`Gemini stopped early: ${finishReason}`);
    parsed = safeParseJSON(text);
  } catch (err) {
    if (attempt < 2) {
      console.error('[generate-plan] malformed/truncated response, retrying once', err);
      return requestPlan(household, retryNote, attempt + 1);
    }
    throw err;
  }
  if (!isMealPlan(parsed)) throw new Error('Gemini response was not a valid MealPlan shape.');
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sign in required.' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { household, seed } = (await req.json()) as { household?: Household; seed?: number };
    if (!household || !Array.isArray(household.members) || household.members.length === 0) {
      return new Response(JSON.stringify({ error: 'A household with at least one member is required.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const hardExclude = unionHardExclusions(household.members);
    const softAvoid = unionSoftAvoid(household.members);
    const allow = deriveAllowList(household.members, regionsInMix(normalizeCuisineMix(household.region, household.cuisines)));
    const hash = await constraintHash(household, hardExclude, softAvoid, allow);
    const isRegenerate = Boolean(seed && seed > 0);

    if (!isRegenerate) {
      const { data: cached } = await admin.from('plan_cache').select('plan_json').eq('constraint_hash', hash).maybeSingle();
      if (cached?.plan_json) {
        // Cheap re-validation even on a cache hit — defense in depth, never
        // trust stored content blindly even though it was validated on write.
        const result = validatePlan(cached.plan_json as MealPlan, hardExclude, household.members);
        return new Response(JSON.stringify({ plan: result.safePlan, hadViolations: !result.ok, cached: true }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    let plan = await requestPlan(household);
    let result = validatePlan(plan, hardExclude, household.members);

    if (!result.ok) {
      const note = `Your previous plan violated these rules: ${result.violations
        .map((v) => v.reason)
        .join('; ')}. Replace every offending meal with one built ONLY from the ALLOW list.`;
      plan = await requestPlan(household, note);
      result = validatePlan(plan, hardExclude, household.members);
    }

    // Refresh the cache with this profile's latest validated plan — on a
    // first generation this populates it; on a regenerate it keeps the
    // cache from going stale, so the next household with this profile still
    // gets some variety over time instead of the very first plan forever.
    await admin.from('plan_cache').upsert(
      { constraint_hash: hash, plan_json: result.safePlan, updated_at: new Date().toISOString() },
      { onConflict: 'constraint_hash' },
    );

    // Defense in depth: whatever happens above, only ever return the
    // engine-validated safe plan, never the raw model output.
    return new Response(JSON.stringify({ plan: result.safePlan, hadViolations: !result.ok, cached: false }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[generate-plan]', err);
    // Gemini's free tier has a small daily quota — surface a distinct,
    // honest message for it rather than a generic failure.
    const rateLimited = err instanceof Error && /\(429\)/.test(err.message);
    return new Response(
      JSON.stringify({
        error: rateLimited
          ? 'Plan generation is at capacity right now — please try again in a few minutes.'
          : 'Plan generation failed. Please try again.',
      }),
      { status: rateLimited ? 429 : 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
