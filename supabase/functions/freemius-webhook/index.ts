/**
 * Freemius → Supabase webhook. Configure this function's URL as the webhook
 * endpoint in the Freemius dashboard (Product → Settings → Webhooks). On a
 * subscription/license event it flips the matching user's row in
 * `subscription_status` to 'pro' (or back to 'free' on cancellation).
 *
 * Server-only secrets (set with `supabase secrets set …`):
 *   FREEMIUS_SECRET_KEY  ← Product → Settings → Keys → Secret Key (sk_…)
 *   SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL  ← injected automatically
 *
 * NOTE: signature verification is stubbed — wire it to FREEMIUS_SECRET_KEY
 * before going live so only Freemius can call this endpoint.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.74.0';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Events that grant / revoke Pro.
const GRANT = new Set(['subscription.created', 'subscription.renewed', 'license.created', 'install.activated']);
const REVOKE = new Set(['subscription.cancelled', 'subscription.expired', 'license.expired', 'license.cancelled']);

function emailFromEvent(body: Record<string, unknown>): string | null {
  const objects = (body.objects ?? {}) as Record<string, unknown>;
  const user = (objects.user ?? body.user ?? {}) as Record<string, unknown>;
  const email = user.email;
  return typeof email === 'string' ? email : null;
}

async function userIdByEmail(email: string): Promise<string | null> {
  // Admin lookup — paginate if you have many users; fine for launch volume.
  const { data } = await admin.auth.admin.listUsers();
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    // TODO: verify the Freemius signature header against FREEMIUS_SECRET_KEY.
    const body = (await req.json()) as Record<string, unknown>;
    const type = String(body.type ?? '');
    const grant = GRANT.has(type);
    const revoke = REVOKE.has(type);
    if (!grant && !revoke) return new Response(JSON.stringify({ ignored: type }), { status: 200 });

    const email = emailFromEvent(body);
    if (!email) return new Response(JSON.stringify({ error: 'no email in event' }), { status: 200 });

    const userId = await userIdByEmail(email);
    if (!userId) return new Response(JSON.stringify({ error: 'no matching user', email }), { status: 200 });

    await admin.from('subscription_status').upsert(
      { user_id: userId, tier: grant ? 'pro' : 'free', source: 'freemius' },
      { onConflict: 'user_id' },
    );
    return new Response(JSON.stringify({ ok: true, user: userId, tier: grant ? 'pro' : 'free' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[freemius-webhook]', err);
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  }
});
