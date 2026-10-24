begin;

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  due_on date not null,
  kind text not null check (
    kind in ('p1', 'p2', 'p3', 'prova', 'recuperacao', 'ep', 'relatorio', 'trabalho', 'entrega')
  ),
  title text not null default '' check (char_length(title) <= 60),
  notes text not null default '' check (char_length(notes) <= 600),
  created_at timestamptz not null default now(),
  constraint assessments_subject_owner_fk
    foreign key (subject_id, user_id)
    references public.subjects(id, user_id)
    on delete cascade
);

create index if not exists assessments_user_date_idx
  on public.assessments (user_id, due_on);

alter table public.assessments enable row level security;

revoke all on table public.assessments from anon;
grant select, insert, update, delete on table public.assessments to authenticated;

drop policy if exists "assessments_owner" on public.assessments;
create policy "assessments_owner"
  on public.assessments for all to authenticated
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

commit;
