alter table public.sportfolio_students add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.sportfolio_students s
set created_by = owner.teacher_user_id
from (
  select m.student_id, min(c.teacher_user_id::text)::uuid as teacher_user_id
  from public.sportfolio_class_memberships m
  join public.sportfolio_classes c on c.id = m.class_id
  group by m.student_id
) owner
where owner.student_id = s.id and s.created_by is null;

create index if not exists sportfolio_students_created_by_idx on public.sportfolio_students(created_by);
create index if not exists sportfolio_classes_teacher_user_id_idx on public.sportfolio_classes(teacher_user_id);

create policy sportfolio_students_teacher_insert
on public.sportfolio_students for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and created_by = (select auth.uid())
  and auth_user_id is null
);

create policy sportfolio_students_creator_select
on public.sportfolio_students for select
to authenticated
using (created_by = (select auth.uid()));

create policy sportfolio_students_creator_update
on public.sportfolio_students for update
to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy sportfolio_students_creator_delete
on public.sportfolio_students for delete
to authenticated
using (created_by = (select auth.uid()) and auth_user_id is null);

create or replace function public.sportfolio_guard_teacher_class_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select auth.uid()) is null or new.teacher_user_id <> (select auth.uid()) then
    raise exception 'You can only create your own Sportfolio classes.';
  end if;

  if (select count(*) from public.sportfolio_classes where teacher_user_id = (select auth.uid())) >= 5 then
    raise exception 'Pilot limit reached: maximum 5 classes per teacher.';
  end if;

  return new;
end;
$$;

drop trigger if exists sportfolio_teacher_class_limit on public.sportfolio_classes;
create trigger sportfolio_teacher_class_limit
before insert on public.sportfolio_classes
for each row execute function public.sportfolio_guard_teacher_class_limit();
