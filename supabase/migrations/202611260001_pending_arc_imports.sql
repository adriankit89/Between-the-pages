-- Between the Pages: private queue for inbound NetGalley approval emails.
-- Run once in the Supabase SQL Editor.

create table if not exists public.pending_arc_imports (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text not null unique,
  source_email text not null,
  subject text not null default '',
  title text not null,
  author text,
  publisher text,
  publication_date text,
  netgalley_url text,
  received_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'imported', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists pending_arc_imports_source_email_idx
  on public.pending_arc_imports (lower(source_email), status, received_at desc);

alter table public.pending_arc_imports enable row level security;

drop policy if exists "Reviewers can read their own pending ARC imports" on public.pending_arc_imports;
create policy "Reviewers can read their own pending ARC imports"
  on public.pending_arc_imports for select to authenticated
  using (lower(source_email) = lower((select auth.jwt() ->> 'email')));

drop policy if exists "Reviewers can update their own pending ARC imports" on public.pending_arc_imports;
create policy "Reviewers can update their own pending ARC imports"
  on public.pending_arc_imports for update to authenticated
  using (lower(source_email) = lower((select auth.jwt() ->> 'email')))
  with check (lower(source_email) = lower((select auth.jwt() ->> 'email')));

grant select, update on public.pending_arc_imports to authenticated;
grant all on public.pending_arc_imports to service_role;
