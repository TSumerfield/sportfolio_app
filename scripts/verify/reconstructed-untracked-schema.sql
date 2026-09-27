-- RECONSTRUCTED, NOT COPIED FROM PRODUCTION.
-- These sportfolio_* tables/functions exist in production but are not created
-- by any file in supabase/migrations/ (they were created outside version
-- control). This file rebuilds only what the roster-import journey and the
-- later migrations need, inferred from application queries and migration
-- references. Replace it with a schema-only dump of production when one is
-- available. Applied between the initial migration and 20260901123500.

create table public.sportfolio_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_year text,
  activity text,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.sportfolio_classes enable row level security;

create table public.sportfolio_students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  grade text,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.sportfolio_students enable row level security;

create table public.sportfolio_class_memberships (
  class_id uuid not null references public.sportfolio_classes(id) on delete cascade,
  student_id uuid not null references public.sportfolio_students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
alter table public.sportfolio_class_memberships enable row level security;
-- Reconstructed policies: a teacher manages memberships of their own classes.
create policy verify_memberships_teacher_select on public.sportfolio_class_memberships
  for select to authenticated using (exists (select 1 from public.sportfolio_classes c where c.id = class_id and c.teacher_user_id = (select auth.uid())));
create policy verify_memberships_teacher_insert on public.sportfolio_class_memberships
  for insert to authenticated with check (exists (select 1 from public.sportfolio_classes c where c.id = class_id and c.teacher_user_id = (select auth.uid())));
create policy verify_memberships_teacher_delete on public.sportfolio_class_memberships
  for delete to authenticated using (exists (select 1 from public.sportfolio_classes c where c.id = class_id and c.teacher_user_id = (select auth.uid())));

create table public.sportfolio_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.sportfolio_tags enable row level security;
create policy verify_tags_owner_all on public.sportfolio_tags
  for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

create table public.sportfolio_items (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid references auth.users(id) on delete cascade,
  class_id uuid references public.sportfolio_classes(id) on delete cascade,
  title text,
  teacher_note text,
  visibility public.item_visibility not null default 'private',
  occurred_at timestamptz not null default now()
);
alter table public.sportfolio_items enable row level security;

create table public.sportfolio_item_students (
  item_id uuid not null references public.sportfolio_items(id) on delete cascade,
  student_id uuid not null references public.sportfolio_students(id) on delete cascade,
  primary key (item_id, student_id)
);
alter table public.sportfolio_item_students enable row level security;

create table public.sportfolio_reflections (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.sportfolio_items(id) on delete cascade,
  student_id uuid references public.sportfolio_students(id) on delete cascade,
  prompt text,
  text_response text,
  voice_storage_path text,
  requested_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
alter table public.sportfolio_reflections enable row level security;

-- Legacy RPC signatures revoked by 20260904080500 (bodies unknown; inert stubs).
create function public.sportfolio_create_class_with_roster(text, jsonb) returns void language sql as $$ select $$;
create function public.sportfolio_publish_evidence(uuid, text, text, uuid[], uuid[], text, text, text) returns void language sql as $$ select $$;
create function public.sportfolio_submit_reflection(uuid, text) returns void language sql as $$ select $$;
create function public.sportfolio_teacher_workspace() returns void language sql as $$ select $$;
