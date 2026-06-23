-- Curious Labs LMS — roles migration (teachers + parents). ADDITIVE & idempotent.
-- Adults authenticate via Supabase Auth (auth.users); this adds their app-level
-- profile (role), class ownership, and parent→child links. Students are untouched.

-- Adult profile, 1:1 with a Supabase Auth user --------------------------------
create table if not exists public.accounts (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  role        text not null check (role in ('teacher', 'parent')),
  created_at  timestamptz not null default now()
);

-- A class is owned by the teacher who created it ------------------------------
alter table public.classes
  add column if not exists owner_account_id uuid references public.accounts(id) on delete set null;
create index if not exists classes_owner_idx on public.classes(owner_account_id);

-- Parent ↔ child links (a parent can follow several children) -----------------
create table if not exists public.parent_links (
  account_id  uuid not null references public.accounts(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (account_id, student_id)
);
create index if not exists parent_links_student_idx on public.parent_links(student_id);

-- Locked down: only the service role (used server-side) touches these ---------
alter table public.accounts     enable row level security;
alter table public.parent_links enable row level security;
