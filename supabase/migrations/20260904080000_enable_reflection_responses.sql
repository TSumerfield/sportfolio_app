create or replace function public.sportfolio_guard_reflection_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1 from public.sportfolio_students s
    where s.id = old.student_id
      and s.auth_user_id = (select auth.uid())
  ) then
    if new.id is distinct from old.id
      or new.item_id is distinct from old.item_id
      or new.student_id is distinct from old.student_id
      or new.prompt is distinct from old.prompt
      or new.requested_at is distinct from old.requested_at
      or new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
    then
      raise exception 'Students may only update their reflection response';
    end if;

    if new.voice_storage_path is not null
      and split_part(new.voice_storage_path, '/', 1) <> (select auth.uid())::text
    then
      raise exception 'Invalid voice reflection path';
    end if;

    if char_length(coalesce(new.text_response, '')) > 2000 then
      raise exception 'Reflection response is too long';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.sportfolio_guard_reflection_update() from public;

drop trigger if exists sportfolio_guard_reflection_update on public.sportfolio_reflections;
create trigger sportfolio_guard_reflection_update
before update on public.sportfolio_reflections
for each row execute function public.sportfolio_guard_reflection_update();

drop policy if exists sportfolio_reflections_student_update on public.sportfolio_reflections;
create policy sportfolio_reflections_student_update
on public.sportfolio_reflections
for update
to authenticated
using (
  exists (
    select 1 from public.sportfolio_students s
    where s.id = sportfolio_reflections.student_id
      and s.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.sportfolio_students s
    where s.id = sportfolio_reflections.student_id
      and s.auth_user_id = (select auth.uid())
  )
);

drop policy if exists sportfolio_reflections_teacher_review on public.sportfolio_reflections;
create policy sportfolio_reflections_teacher_review
on public.sportfolio_reflections
for update
to authenticated
using (
  exists (
    select 1 from public.sportfolio_items i
    where i.id = sportfolio_reflections.item_id
      and i.author_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.sportfolio_items i
    where i.id = sportfolio_reflections.item_id
      and i.author_user_id = (select auth.uid())
  )
);

drop policy if exists sportfolio_teacher_reads_reflection_voice on storage.objects;
create policy sportfolio_teacher_reads_reflection_voice
on storage.objects
for select
to authenticated
using (
  bucket_id = 'sportfolio-media'
  and exists (
    select 1
    from public.sportfolio_reflections r
    join public.sportfolio_items i on i.id = r.item_id
    where r.voice_storage_path = objects.name
      and i.author_user_id = (select auth.uid())
  )
);
