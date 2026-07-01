-- Optional per-member photo, uploaded to the existing 'avatars' storage bucket
-- (same bucket profile photos already use — see src/lib/imageUpload.ts).
-- Falls back to a first-letter initial badge in the UI when unset.

alter table public.members
  add column if not exists avatar_url text;

-- No new RLS policy needed: members is already covered by the "own household"
-- policies from 0001, and this is just another nullable column on that row.
