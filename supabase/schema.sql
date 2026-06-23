-- Curious Labs LMS — backend schema (Supabase / Postgres)
-- ---------------------------------------------------------------------------
-- Kid-safe model: a teacher/parent creates a CLASS (gets a join code); a
-- learner joins with { class code + name + 4-digit PIN }. No child emails.
-- The PIN is scrypt-hashed in the app; we only ever store the hash.
--
-- Security: every table has RLS ENABLED with NO policies, so the anon/auth
-- PostgREST roles can touch nothing. The app reaches the DB exclusively from
-- Next.js Server Actions using the service_role key (which bypasses RLS),
-- and scopes every query by the session's student id. Defense in depth.
--
-- Apply this once in the Supabase dashboard → SQL Editor → paste → Run.
-- Safe to re-run: it uses IF NOT EXISTS / ON CONFLICT throughout.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- Classes a teacher/parent creates; learners join with the code -------------
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,          -- short join code, e.g. "SPARK-7423"
  name        text not null,
  created_at  timestamptz not null default now()
);

-- A learner profile within a class. PIN hashed (scrypt). No email collected --
create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes(id) on delete cascade,
  name          text not null,               -- login name (as typed)
  name_key      text not null,               -- lower(trim(name)) for uniqueness
  display_name  text,                         -- editable name on certificates
  pin_hash      text not null,               -- "salt:hash" (scrypt, hex)
  avatar        text,                         -- equipped avatar cosmetic id (denormalised)
  created_at    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  unique (class_id, name_key)
);
create index if not exists students_class_idx on public.students(class_id);

-- One row per completed activity — relational, so teacher analytics &
-- leaderboards are a simple GROUP BY later. ---------------------------------
create table if not exists public.progress (
  student_id    uuid not null references public.students(id) on delete cascade,
  activity_id   text not null,
  stars         smallint not null check (stars between 1 and 3),
  completed_at  timestamptz not null default now(),
  primary key (student_id, activity_id)
);

-- Per-student state blobs (small, read/written whole) -----------------------
create table if not exists public.streaks (
  student_id  uuid primary key references public.students(id) on delete cascade,
  current     int  not null default 0,
  best        int  not null default 0,
  last_day    text not null default ''        -- 'YYYY-MM-DD', learner-local
);

create table if not exists public.cosmetics (
  student_id  uuid primary key references public.students(id) on delete cascade,
  owned       text[] not null default '{}',
  equipped    jsonb  not null default '{}'::jsonb
);

create table if not exists public.creations (
  student_id  uuid primary key references public.students(id) on delete cascade,
  items       jsonb  not null default '[]'::jsonb  -- array of Creation objects
);

-- Lock everything down: RLS on, zero policies → only service_role gets in ---
alter table public.classes   enable row level security;
alter table public.students  enable row level security;
alter table public.progress  enable row level security;
alter table public.streaks   enable row level security;
alter table public.cosmetics enable row level security;
alter table public.creations enable row level security;

-- A ready-made demo class so you can test joining immediately ---------------
insert into public.classes (code, name)
values ('CURIOUS-LAB', 'Demo Class')
on conflict (code) do nothing;
