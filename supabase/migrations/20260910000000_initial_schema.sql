begin;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color text not null default '#6366f1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  studied_on date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  kind text not null check (kind in ('teoria', 'exercicios')),
  notes text not null default '' check (char_length(notes) <= 1200),
  created_at timestamptz not null default now(),
  constraint study_logs_subject_owner_fk
    foreign key (subject_id, user_id)
    references public.subjects(id, user_id)
    on delete cascade
);

create unique index subjects_user_name_idx
  on public.subjects (user_id, lower(trim(name)));
create index subjects_user_idx on public.subjects (user_id);
create index study_logs_user_date_idx
  on public.study_logs (user_id, studied_on desc, created_at desc);

alter table public.subjects enable row level security;
alter table public.study_logs enable row level security;

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

commit;
