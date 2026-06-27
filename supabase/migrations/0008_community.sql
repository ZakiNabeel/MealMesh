-- Milestone 3: Reddit-style community — posts, recipes, threaded comments,
-- votes, reports (with auto-hide), and blocks.
--
-- Same privacy firewall as M1/M2 (context §10): nothing here ever stores or
-- exposes a member's dietary/medical/religious constraint data. Community
-- recipes are free-text user content, NOT run through the engine's
-- validatePlan safety pass — the app makes that distinction clear in the UI.

-- ===========================================================================
-- recipes — user-submitted, public by default once shared
-- ===========================================================================

create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  description text,
  image_url   text,
  ingredients jsonb not null default '[]'::jsonb,
  steps       jsonb not null default '[]'::jsonb,
  cuisine     text,
  diet_tags   text[] not null default '{}',
  is_public   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists recipes_author_idx on public.recipes (author_id);

-- ===========================================================================
-- posts — feed items: text, photo, or a shared recipe
-- ===========================================================================

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references auth.users (id) on delete cascade,
  type       text not null check (type in ('text', 'photo', 'recipe')),
  body       text,
  image_url  text,
  recipe_id  uuid references public.recipes (id) on delete set null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_author_idx on public.posts (author_id);

-- ===========================================================================
-- comments — threaded (one level of reply via parent_comment_id)
-- ===========================================================================

create table if not exists public.comments (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null references public.posts (id) on delete cascade,
  author_id          uuid not null references auth.users (id) on delete cascade,
  parent_comment_id  uuid references public.comments (id) on delete cascade,
  body               text not null,
  hidden             boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id);

-- ===========================================================================
-- votes — one vote per user per target (post or comment), value is ±1
-- ===========================================================================

create table if not exists public.votes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   uuid not null,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create index if not exists votes_target_idx on public.votes (target_type, target_id);

-- ===========================================================================
-- reports — flagging; auto-hides content once enough distinct users flag it
-- ===========================================================================

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   uuid not null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- Auto-hide once REPORT_THRESHOLD distinct people have reported the same
-- target — keeps moderation flowing without a human in the loop for v1. The
-- founder can still manually review/unhide directly in the Supabase table.
create or replace function public.handle_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_threshold constant int := 5;
begin
  select count(distinct reporter_id) into v_count
  from public.reports
  where target_type = new.target_type and target_id = new.target_id;

  if v_count >= v_threshold then
    if new.target_type = 'post' then
      update public.posts set hidden = true where id = new.target_id;
    elsif new.target_type = 'comment' then
      update public.comments set hidden = true where id = new.target_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reports_after_insert on public.reports;
create trigger reports_after_insert
  after insert on public.reports
  for each row execute function public.handle_new_report();

-- ===========================================================================
-- blocks — one-directional: a blocker stops seeing the blocked user's content
-- ===========================================================================

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.recipes  enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;
alter table public.votes    enable row level security;
alter table public.reports  enable row level security;
alter table public.blocks   enable row level security;

drop policy if exists recipes_read on public.recipes;
create policy recipes_read on public.recipes
  for select
  using (is_public or author_id = auth.uid());

drop policy if exists recipes_insert_own on public.recipes;
create policy recipes_insert_own on public.recipes
  for insert
  with check (author_id = auth.uid());

drop policy if exists recipes_update_own on public.recipes;
create policy recipes_update_own on public.recipes
  for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists recipes_delete_own on public.recipes;
create policy recipes_delete_own on public.recipes
  for delete
  using (author_id = auth.uid());

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts
  for select
  using (not hidden or author_id = auth.uid());

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert
  with check (author_id = auth.uid());

drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts
  for delete
  using (author_id = auth.uid());

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments
  for select
  using (not hidden or author_id = auth.uid());

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert
  with check (author_id = auth.uid());

drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments
  for delete
  using (author_id = auth.uid());

-- votes: tallies must be publicly readable (the feed shows a net score to
-- everyone); writes are restricted to the voter's own row.
drop policy if exists votes_read on public.votes;
create policy votes_read on public.votes
  for select
  using (true);

drop policy if exists votes_upsert_own on public.votes;
create policy votes_upsert_own on public.votes
  for insert
  with check (user_id = auth.uid());

drop policy if exists votes_update_own on public.votes;
create policy votes_update_own on public.votes
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists votes_delete_own on public.votes;
create policy votes_delete_own on public.votes
  for delete
  using (user_id = auth.uid());

-- reports: write-only from the client's perspective — a reporter can see
-- their own past reports (to grey out "report" once already used) but no one
-- can browse who-reported-what for someone else.
drop policy if exists reports_read_own on public.reports;
create policy reports_read_own on public.reports
  for select
  using (reporter_id = auth.uid());

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert
  with check (reporter_id = auth.uid());

-- blocks: a user only ever needs their own block list to filter their feed.
drop policy if exists blocks_read_own on public.blocks;
create policy blocks_read_own on public.blocks
  for select
  using (blocker_id = auth.uid());

drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks
  for insert
  with check (blocker_id = auth.uid());

drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks
  for delete
  using (blocker_id = auth.uid());

-- ===========================================================================
-- Storage: post-images bucket already exists (migration 0005); recipes reuse
-- it via the same per-user-folder policies, so no Storage changes are needed.
-- ===========================================================================
