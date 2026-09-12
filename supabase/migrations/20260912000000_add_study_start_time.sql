alter table public.study_logs
  add column if not exists start_time time without time zone;
