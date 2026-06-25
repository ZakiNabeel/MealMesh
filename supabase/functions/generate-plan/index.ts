/**
 * Edge Function: proxies the Claude API to generate a household's weekly meal
 * plan. The Anthropic API key lives only in this function's secrets — it is
 * never sent to or readable by the client.
 *
 * Mirrors docs/MealMesh-context.md §4: HARD_EXCLUDE / SOFT_AVOID / ALLOW are
 * derived by the SAME constraint engine the app uses (imported straight from
 * src/lib, see ./deno.json for the path-alias mapping), sent to Claude as
 * structured JSON (never raw user text), and the response is run back through
 * the engine's deterministic `validatePlan` safety pass before it ever reaches
 * a client. If a violation slips through, we ask Claude to fix it once more;
 * if it still fails, we return the engine-scrubbed safe plan rather than an
 * unsafe one.
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.70.1';
import { createClient } from 'npm:@supabase/supabase-js@2.74.0';

import { deriveAllowList, unionHardExclusions, unionSoftAvoid, validatePlan } from '../../../src/lib/constraints.ts';
import type { Household, MealPlan } from '../../../src/types/index.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT =
  'You are a culturally-aware household meal planner. You MUST respect halal, kosher, ' +
  'and all medical/allergen rules exactly. Use ONLY ingredients consistent with the ALLOW ' +
  'list and never any item in HARD_EXCLUDE.\n' +
  'MEALS: Produce FOUR meals for EACH of the 7 days — slot must be one of ' +
  '"breakfast","lunch","supper","dinner" (28 entries total). Breakfasts should be ' +
  'breakfast-appropriate for the region (e.g. south_asian: anda paratha, chana, halwa puri).\n' +
  'CUISINE: When a `region` other than "none" is given, the MAJORITY of meals must be ' +
  'authentic, named dishes of that cuisine (e.g. south_asian: karahi, biryani, daal, pulao, ' +
  'sabzi, qeema — not generic "traybake" or "stir-fry"). Use that cuisine\'s real spices and ' +
  'techniques. A few lighter/global meals are fine for variety.\n' +
  'RECIPES: For every meal include a `recipe` with `servings` (number), `timeMinutes` ' +
  '(number), and `steps` (5–8 short numbered instructions a home cook can follow), plus a ' +
  '`cuisine` label string.\n' +
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

async function requestPlan(household: Household, retryNote?: string): Promise<MealPlan> {
  const hardExclude = unionHardExclusions(household.members);
  const softAvoid = unionSoftAvoid(household.members);
  const allow = deriveAllowList(household.members, household.region);

  const payload = {
    members: household.members.map((m) => ({ name: m.name, constraints: m.constraints })),
    HARD_EXCLUDE: hardExclude,
    SOFT_AVOID: softAvoid,
    ALLOW: allow,
    region: household.region,
    days: 7,
    mealsPerDay: ['breakfast', 'lunch', 'supper', 'dinner'],
    format:
      '{"days":[{"dayOfWeek":"monday".."sunday","slot":"breakfast"|"lunch"|"supper"|"dinner",' +
      '"name":string,"sharedOrVariant":"shared"|"variant","ingredients":string[],"satisfies":string[],' +
      '"cuisine":string,"recipe":{"servings":number,"timeMinutes":number,"steps":string[]}}],' +
      '"grocery":[{"name":string,"category":string,"quantity":string}]}',
    ...(retryNote ? { correction: retryNote } : {}),
  };

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  });

  const text = resp.content.find((b) => b.type === 'text')?.text ?? '';
  const parsed = safeParseJSON(text);
  if (!isMealPlan(parsed)) throw new Error('Claude response was not a valid MealPlan shape.');
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

    const { household } = (await req.json()) as { household?: Household };
    if (!household || !Array.isArray(household.members) || household.members.length === 0) {
      return new Response(JSON.stringify({ error: 'A household with at least one member is required.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const hardExclude = unionHardExclusions(household.members);

    let plan = await requestPlan(household);
    let result = validatePlan(plan, hardExclude, household.members);

    if (!result.ok) {
      const note = `Your previous plan violated these rules: ${result.violations
        .map((v) => v.reason)
        .join('; ')}. Replace every offending meal with one built ONLY from the ALLOW list.`;
      plan = await requestPlan(household, note);
      result = validatePlan(plan, hardExclude, household.members);
    }

    // Defense in depth: whatever happens above, only ever return the
    // engine-validated safe plan, never the raw model output.
    return new Response(JSON.stringify({ plan: result.safePlan, hadViolations: !result.ok }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[generate-plan]', err);
    return new Response(JSON.stringify({ error: 'Plan generation failed. Please try again.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
