-- Marketing email consent (opt-in).
--
-- Emails already live in auth.users, but sending PROMOTIONAL email requires
-- explicit consent (CAN-SPAM / GDPR). This records that opt-in per user. It is
-- FALSE by default — a user is only marketable after they actively check the
-- box on the auth screen. To build a send list, join profiles (marketing_opt_in
-- = true) to auth.users.email server-side with the service role.

alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz;

-- A user may update their own consent (the app writes it after sign-in); this
-- relies on the existing "own profile" update policy from 0005. No new policy
-- needed — just confirm the column is covered by the row-level own-profile rule.
