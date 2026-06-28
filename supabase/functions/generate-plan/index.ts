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

import { deriveAllowList, unionHardExclusions, unionSoftAvoid, validatePlan } from '../../../src/lib/constraints.ts';
import type { Household, MealPlan } from '../../../src/types/index.ts';

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
  const canonical = {
    hardExclude: [...hardExclude].sort(),
    softAvoid: [...softAvoid].sort(),
    allow: Object.fromEntries(Object.entries(allow).map(([k, v]) => [k, [...(v as string[])].sort()])),
    region: household.region ?? null,
    budgetWeekly: household.budgetWeekly ?? null,
    currency: household.currency ?? null,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SYSTEM_PROMPT =
  'You are a culturally-aware household meal planner. You MUST respect halal, kosher, ' +
  'and all medical/allergen rules exactly. Use ONLY ingredients consistent with the ALLOW ' +
  'list and never any item in HARD_EXCLUDE.\n' +
  'MEALS: Produce FOUR meals for EACH of the 7 days — slot must be one of ' +
  '"breakfast","lunch","supper","dinner" (28 entries total). Breakfasts should be ' +
  'breakfast-appropriate for the region (e.g. south_asian: anda paratha, chana, halwa puri).\n' +
  'SUPPER is the LIGHT evening tea-time snack that pairs with chai/tea or coffee — small and ' +
  'quick, NOT a second full dinner. Examples: south_asian: pakoray, samosa, chana chaat, masala ' +
  'toast, aloo tikki, dahi bhalla, biscuits/rusk; western: a cheese toastie, savoury muffin, ' +
  'scone, dip with crackers. Keep supper simple and small. "lunch" and "dinner" are the full meals.\n' +
  'CUISINE: When a `region` other than "none" is given, the MAJORITY of meals must be ' +
  'authentic, named dishes of that cuisine (e.g. south_asian: karahi, biryani, daal, pulao, ' +
  'sabzi, qeema — not generic "traybake" or "stir-fry"). Use that cuisine\'s real spices and ' +
  'techniques. A few lighter/global meals are fine for variety.\n' +
  'RECIPES: For every meal include a `recipe` with `servings` (number), `timeMinutes` ' +
  '(number), and `steps` (5–8 short numbered instructions a home cook can follow), plus a ' +
  '`cuisine` label string.\n' +
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
  const allow = deriveAllowList(household.members, household.region);

  const payload = {
    // Anonymized on purpose — the output schema (below) never references a
    // member by name, only by constraint, so the model never needs real
    // names to do its job. One less thing leaving the building.
    members: household.members.map((m, i) => ({ member: `member_${i + 1}`, constraints: m.constraints })),
    HARD_EXCLUDE: hardExclude,
    SOFT_AVOID: softAvoid,
    ALLOW: allow,
    region: household.region,
    budgetWeekly: household.budgetWeekly ?? null,
    currency: household.currency ?? null,
    days: 7,
    mealsPerDay: ['breakfast', 'lunch', 'supper', 'dinner'],
    format:
      '{"days":[{"dayOfWeek":"monday".."sunday","slot":"breakfast"|"lunch"|"supper"|"dinner",' +
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
      // 28 meals × a 5-8 step recipe each, plus a grocery list, easily runs
      // past 8000 tokens and gets truncated mid-JSON — raise the ceiling well
      // above what a full week's worth of output actually needs.
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 16000 },
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
    const allow = deriveAllowList(household.members, household.region);
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
