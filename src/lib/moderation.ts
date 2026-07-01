/**
 * First-line content moderation for user-generated community content
 * (posts, comments, shared recipes).
 *
 * This is a deterministic, offline gate that blocks the OBVIOUS cases at submit
 * time — slurs/strong profanity and classic spam shapes (link floods, contact/
 * crypto solicitation, gibberish, shouting). It runs BEFORE the row is written.
 *
 * It is deliberately layered, not a silver bullet:
 *   1. this filter        — stops the blatant stuff instantly, no network
 *   2. report → auto-hide — community flags content; 5 distinct reporters hide it
 *      (migration 0008 trigger)
 *   3. (recommended next)  — an async server-side review pass (LLM/Perspective API)
 *      for nuanced abuse this keyword gate can't catch. See notes in README.
 *
 * Keep the word lists conservative to avoid false positives on real cooking talk.
 */

export interface ModerationResult {
  ok: boolean;
  /** User-facing reason when blocked (safe to show verbatim). */
  reason?: string;
}

// Strong slurs / severe profanity. Matched as whole words, case/spacing
// insensitive. Intentionally short — this is the "never allowed" set, not a
// prudishness filter. `\b` word-boundaries avoid Scunthorpe-style false hits.
const BLOCKED = [
  'nigger', 'nigga', 'faggot', 'retard', 'chink', 'spic', 'kike', 'wetback',
  'tranny', 'coon', 'paki', 'cunt',
];

// Spam / solicitation cues — these gate only when combined with spammy SHAPE
// below, so ordinary sentences that happen to contain "free" don't trip.
const SPAM_TERMS = [
  'viagra', 'casino', 'crypto giveaway', 'bitcoin doubler', 'forex signals',
  'work from home', 'make money fast', 'click here to win', 'telegram @',
  'whatsapp +', 'onlyfans', 'promo code', 'sign up bonus',
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    // collapse leetspeak-ish separators so "n i g g e r" / "n.i.g.g.e.r" still match
    .replace(/[\s._\-*]+/g, ' ')
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/\$/g, 's')
    .replace(/3/g, 'e');
}

function hasBlockedWord(text: string): boolean {
  const n = normalize(text);
  const compact = n.replace(/ /g, '');
  return BLOCKED.some((w) => new RegExp(`\\b${w}\\b`).test(n) || compact.includes(w));
}

function looksLikeSpam(raw: string): boolean {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // Link flood: 3+ URLs, or a URL in a very short post.
  const urls = (text.match(/https?:\/\/|www\.|\b\S+\.(?:com|net|io|xyz|ru|top|link)\b/gi) ?? []).length;
  if (urls >= 3) return true;

  // Solicitation term present.
  if (SPAM_TERMS.some((t) => lower.includes(t))) return true;

  // Shouting: long and mostly uppercase.
  const letters = text.replace(/[^a-z]/gi, '');
  if (letters.length > 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) return true;

  // Character spam: the same char repeated 8+ times (e.g. "aaaaaaaa", "!!!!!!!!").
  if (/(.)\1{7,}/.test(text)) return true;

  return false;
}

/**
 * Gate a piece of user text. `min` is the minimum trimmed length (skip for
 * optional fields by passing 0).
 */
export function moderateText(input: string | null | undefined, opts: { min?: number } = {}): ModerationResult {
  const text = (input ?? '').trim();
  const min = opts.min ?? 0;

  if (text.length < min) return { ok: false, reason: `Add a little more — at least ${min} characters.` };
  if (!text) return { ok: true };

  if (hasBlockedWord(text)) {
    return { ok: false, reason: 'This contains language that isn’t allowed in the community. Please rephrase.' };
  }
  if (looksLikeSpam(text)) {
    return { ok: false, reason: 'This looks like spam or promotion, which isn’t allowed here.' };
  }
  return { ok: true };
}
