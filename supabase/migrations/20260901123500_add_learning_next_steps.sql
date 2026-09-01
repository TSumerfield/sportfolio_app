-- Sportfolio learning intelligence foundation.
-- A next step is deliberately teacher-confirmed. AI suggestions can populate
-- suggested_body later, while final_body preserves the teacher's judgement.
create table if not exists public.sportfolio_next_steps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.sportfolio_students(id) on delete cascade,
  source_item_id uuid not null references public.sportfolio_items(id) on delete cascade,
  suggested_body text,
  final_body text not null,
  status text not null default 'accepted' check (status in ('accepted','edited','ignored','completed')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists sportfolio_next_steps_student_created_idx
  on public.sportfolio_next_steps(student_id, created_at desc);
create index if not exists sportfolio_next_steps_source_item_idx
  on public.sportfolio_next_steps(source_item_id);

alter table public.sportfolio_next_steps enable row level security;
grant select, insert, update, delete on public.sportfolio_next_steps to authenticated;

create policy "teachers_select_next_steps" on public.sportfolio_next_steps for select to authenticated
using (exists (
  select 1 from public.sportfolio_class_memberships m
  join public.sportfolio_classes c on c.id = m.class_id
  where m.student_id = sportfolio_next_steps.student_id
    and c.teacher_user_id = (select auth.uid())
));

create policy "teachers_insert_next_steps" on public.sportfolio_next_steps for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.sportfolio_class_memberships m
    join public.sportfolio_classes c on c.id = m.class_id
    where m.student_id = sportfolio_next_steps.student_id
      and c.teacher_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.sportfolio_items i
    where i.id = sportfolio_next_steps.source_item_id
      and i.author_user_id = (select auth.uid())
  )
);

create policy "teachers_update_next_steps" on public.sportfolio_next_steps for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy "teachers_delete_next_steps" on public.sportfolio_next_steps for delete to authenticated
using (created_by = (select auth.uid()));
