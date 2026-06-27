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
 * Every request is verified against an HMAC-SHA256 signature of the raw body
 * (Freemius's documented webhook signing scheme, sent as the X-Signature
 * header) before anything is parsed or written — otherwise anyone who finds
 * this URL could POST a fake `subscription.created` event and grant
 * themselves Pro for free.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.74.0';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const SECRET_KEY = Deno.env.get('FREEMIUS_SECRET_KEY') ?? '';
const SIGNATURE_HEADER = 'X-Signature';

async function isValidSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature || !SECRET_KEY) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Lengths are equal/fixed (both hex SHA-256 digests), so a simple
  // char-by-char compare is fine — no early-exit timing leak of substance.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

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
    const rawBody = await req.text();
    const signature = req.headers.get(SIGNATURE_HEADER);
    if (!(await isValidSignature(rawBody, signature))) {
      // Log the headers we actually got so a mismatch (e.g. Freemius using a
      // differently-named or differently-cased header) is easy to spot and
      // fix instead of silently rejecting every real event forever.
      console.error('[freemius-webhook] signature check failed', {
        sawHeader: signature,
        allHeaders: Object.fromEntries(req.headers.entries()),
      });
      return new Response('Invalid signature', { status: 401 });
    }
    const body = JSON.parse(rawBody) as Record<string, unknown>;
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
    // Keep the public-readable flair flag in sync (subscription_status itself
    // is owner-private, but the leaderboard needs to show Pro on other rows).
    await admin.from('profiles').update({ is_pro: grant }).eq('user_id', userId);
    return new Response(JSON.stringify({ ok: true, user: userId, tier: grant ? 'pro' : 'free' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[freemius-webhook]', err);
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  }
});
