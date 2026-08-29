drop policy "Users can read their archive objects" on storage.objects;
drop policy "Users can create their archive objects" on storage.objects;
drop policy "Users can delete their archive objects" on storage.objects;

create policy "Users can read their archive objects"
  on storage.objects for select to authenticated using (
    bucket_id = 'project-archives' and exists (
      select 1 from public.projects
      where projects.id = (storage.foldername(storage.objects.name))[2]::uuid
        and projects.owner_id = (select auth.uid())
        and projects.deleted_at is null
    )
  );

create policy "Users can create their archive objects"
  on storage.objects for insert to authenticated with check (
    bucket_id = 'project-archives' and exists (
      select 1 from public.projects
      where projects.id = (storage.foldername(storage.objects.name))[2]::uuid
        and projects.owner_id = (select auth.uid())
        and projects.deleted_at is null
    )
  );

create policy "Users can delete their archive objects"
  on storage.objects for delete to authenticated using (
    bucket_id = 'project-archives' and exists (
      select 1 from public.projects
      where projects.id = (storage.foldername(storage.objects.name))[2]::uuid
        and projects.owner_id = (select auth.uid())
        and projects.deleted_at is null
    )
  );