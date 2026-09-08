create table if not exists public.sportfolio_pilot_access (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email))),
  active boolean not null default true,
  invited_at timestamptz not null default now(),
  note text
);

alter table public.sportfolio_pilot_access enable row level security;

revoke all on table public.sportfolio_pilot_access from anon, authenticated;
grant select on table public.sportfolio_pilot_access to authenticated;

insert into public.sportfolio_pilot_access(email, note)
select distinct lower(trim(u.email)), 'Existing Sportfolio teacher'
from auth.users u
join public.sportfolio_classes c on c.teacher_user_id = u.id
where u.email is not null
on conflict (email) do update set active = true;

drop policy if exists sportfolio_pilot_access_self_select on public.sportfolio_pilot_access;
create policy sportfolio_pilot_access_self_select
on public.sportfolio_pilot_access for select
to authenticated
using (
  active
  and email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

drop policy if exists "sportfolio teacher class access" on public.sportfolio_classes;
drop policy if exists sportfolio_classes_teacher_select on public.sportfolio_classes;
drop policy if exists sportfolio_classes_teacher_insert on public.sportfolio_classes;
drop policy if exists sportfolio_classes_teacher_update on public.sportfolio_classes;
drop policy if exists sportfolio_classes_teacher_delete on public.sportfolio_classes;

create policy sportfolio_classes_teacher_select
on public.sportfolio_classes for select
to authenticated
using (teacher_user_id = (select auth.uid()));

create policy sportfolio_classes_teacher_insert
on public.sportfolio_classes for insert
to authenticated
with check (
  teacher_user_id = (select auth.uid())
  and exists (
    select 1 from public.sportfolio_pilot_access p
    where p.active
      and p.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

create policy sportfolio_classes_teacher_update
on public.sportfolio_classes for update
to authenticated
using (teacher_user_id = (select auth.uid()))
with check (teacher_user_id = (select auth.uid()));

create policy sportfolio_classes_teacher_delete
on public.sportfolio_classes for delete
to authenticated
using (teacher_user_id = (select auth.uid()));

drop policy if exists sportfolio_students_teacher_insert on public.sportfolio_students;
create policy sportfolio_students_teacher_insert
on public.sportfolio_students for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and created_by = (select auth.uid())
  and auth_user_id is null
  and exists (
    select 1 from public.sportfolio_pilot_access p
    where p.active
      and p.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);
