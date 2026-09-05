create schema if not exists sportfolio_private;
revoke all on schema sportfolio_private from public;
grant usage on schema sportfolio_private to authenticated;

create or replace function sportfolio_private.is_item_author(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.sportfolio_items i
    where i.id = p_item_id
      and i.author_user_id = auth.uid()
  );
$$;

create or replace function sportfolio_private.is_linked_student_visible(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.sportfolio_items i
    join public.sportfolio_item_students pis on pis.item_id = i.id
    join public.sportfolio_students s on s.id = pis.student_id
    where i.id = p_item_id
      and i.visibility = 'student_visible'
      and s.auth_user_id = auth.uid()
  );
$$;

revoke all on function sportfolio_private.is_item_author(uuid) from public;
revoke all on function sportfolio_private.is_linked_student_visible(uuid) from public;
grant execute on function sportfolio_private.is_item_author(uuid) to authenticated;
grant execute on function sportfolio_private.is_linked_student_visible(uuid) to authenticated;

drop policy if exists "sportfolio items access" on public.sportfolio_items;
drop policy if exists "sportfolio teacher reads own evidence" on public.sportfolio_items;
drop policy if exists "sportfolio_items_teacher_or_linked_student" on public.sportfolio_items;
create policy sportfolio_items_select
on public.sportfolio_items
for select
to authenticated
using (
  author_user_id = (select auth.uid())
  or sportfolio_private.is_linked_student_visible(id)
);

drop policy if exists "sportfolio item pupil access" on public.sportfolio_item_students;
drop policy if exists "sportfolio teacher reads own evidence links" on public.sportfolio_item_students;
drop policy if exists "sportfolio_item_students_teacher_or_self" on public.sportfolio_item_students;
create policy sportfolio_item_students_select
on public.sportfolio_item_students
for select
to authenticated
using (
  sportfolio_private.is_item_author(item_id)
  or exists (
    select 1
    from public.sportfolio_students s
    where s.id = sportfolio_item_students.student_id
      and s.auth_user_id = (select auth.uid())
  )
);
