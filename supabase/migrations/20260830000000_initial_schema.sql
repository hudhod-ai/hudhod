create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  company text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision integer not null check (revision > 0),
  label text,
  description text,
  storage_key text not null,
  storage_bucket text not null default 'project-archives',
  content_type text not null default 'application/json',
  size_bytes integer not null check (size_bytes >= 0),
  checksum_sha256 text not null,
  file_count integer not null check (file_count >= 0),
  restored_from_version_id uuid references public.project_versions(id),
  download_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  unique (project_id, revision)
);

alter table public.projects
  add constraint projects_current_version_id_fkey
  foreign key (current_version_id) references public.project_versions(id);

create unique index projects_owner_slug_unique
  on public.projects (owner_id, slug) where deleted_at is null;
create index projects_owner_id_idx on public.projects (owner_id);
create index projects_deleted_at_idx on public.projects (deleted_at);
create index project_versions_project_id_idx on public.project_versions (project_id);
create index project_versions_deleted_at_idx on public.project_versions (deleted_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, company, country, created_by, updated_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'company', ''),
    nullif(new.raw_user_meta_data ->> 'country', ''),
    new.id,
    new.id
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_versions enable row level security;

create policy "Users can read their profile"
  on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update their profile"
  on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users can read their projects"
  on public.projects for select to authenticated using ((select auth.uid()) = owner_id and deleted_at is null);
create policy "Users can create their projects"
  on public.projects for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Users can update their projects"
  on public.projects for update to authenticated using ((select auth.uid()) = owner_id and deleted_at is null) with check ((select auth.uid()) = owner_id);

create policy "Users can read their project versions"
  on public.project_versions for select to authenticated using (
    exists (select 1 from public.projects where projects.id = project_id and projects.owner_id = (select auth.uid()) and projects.deleted_at is null)
  );
create policy "Users can create their project versions"
  on public.project_versions for insert to authenticated with check (
    exists (select 1 from public.projects where projects.id = project_id and projects.owner_id = (select auth.uid()) and projects.deleted_at is null)
  );
create policy "Users can update their project versions"
  on public.project_versions for update to authenticated using (
    exists (select 1 from public.projects where projects.id = project_id and projects.owner_id = (select auth.uid()) and projects.deleted_at is null)
  ) with check (
    exists (select 1 from public.projects where projects.id = project_id and projects.owner_id = (select auth.uid()) and projects.deleted_at is null)
  );

insert into storage.buckets (id, name, public)
values ('project-archives', 'project-archives', false)
on conflict (id) do nothing;

create policy "Users can read their archive objects"
  on storage.objects for select to authenticated using (
    bucket_id = 'project-archives' and exists (
      select 1 from public.projects
      where id = (storage.foldername(name))[2]::uuid
        and owner_id = (select auth.uid())
        and deleted_at is null
    )
  );
create policy "Users can create their archive objects"
  on storage.objects for insert to authenticated with check (
    bucket_id = 'project-archives' and exists (
      select 1 from public.projects
      where id = (storage.foldername(name))[2]::uuid
        and owner_id = (select auth.uid())
        and deleted_at is null
    )
  );
create policy "Users can delete their archive objects"
  on storage.objects for delete to authenticated using (
    bucket_id = 'project-archives' and exists (
      select 1 from public.projects
      where id = (storage.foldername(name))[2]::uuid
        and owner_id = (select auth.uid())
        and deleted_at is null
    )
  );