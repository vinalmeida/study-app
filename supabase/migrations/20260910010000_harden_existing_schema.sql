begin;

alter table public.subjects
  add constraint subjects_id_user_id_key unique (id, user_id);

alter table public.subjects
  add constraint subjects_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.study_logs
  add constraint study_logs_notes_length_check check (char_length(notes) <= 1200);

alter table public.study_logs drop constraint study_logs_subject_id_fkey;
alter table public.study_logs
  add constraint study_logs_subject_owner_fk
  foreign key (subject_id, user_id)
  references public.subjects(id, user_id)
  on delete cascade;

drop policy subjects_owner on public.subjects;
drop policy study_logs_owner on public.study_logs;

revoke all on table public.subjects from anon;
revoke all on table public.study_logs from anon;
grant select, insert, update, delete on table public.subjects to authenticated;
grant select, insert, update, delete on table public.study_logs to authenticated;

create policy "subjects_owner"
  on public.subjects for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "study_logs_owner"
  on public.study_logs for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and exists (
      select 1 from public.subjects
      where subjects.id = subject_id
        and subjects.user_id = (select auth.uid())
        and subjects.archived = false
    )
  );

drop index if exists public.study_logs_user_date_idx;
create index study_logs_user_date_idx
  on public.study_logs (user_id, studied_on desc, created_at desc);

commit;
