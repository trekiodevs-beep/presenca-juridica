create table public.lead_documents (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  name text not null,
  file_name text not null,
  content_type text not null default 'application/octet-stream',
  size bigint not null default 0 check (size >= 0),
  storage_path text not null unique,
  category text not null default 'Outro',
  visible_in_portal boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index lead_documents_office_lead_idx on public.lead_documents (office_id, lead_id, created_at desc);
alter table public.lead_documents enable row level security;
create policy lead_documents_member_read on public.lead_documents for select to authenticated using (public.is_office_member(office_id));
create policy lead_documents_operator_write on public.lead_documents for all to authenticated using (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant'])) with check (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant']));
create trigger lead_documents_set_updated_at before update on public.lead_documents for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values ('lead-documents', 'lead-documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy lead_documents_storage_read on storage.objects for select to authenticated using (
  bucket_id = 'lead-documents' and public.is_office_member((storage.foldername(name))[1]::uuid)
);
create policy lead_documents_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'lead-documents' and public.has_office_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'lawyer', 'assistant'])
);
create policy lead_documents_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'lead-documents' and public.has_office_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'lawyer', 'assistant'])
);

create or replace function public.get_portal_document_path(portal_token text, requested_document_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select d.storage_path
  from public.lead_documents d
  join public.client_portal_access p on p.id = portal_token and p.is_active = true
    and (p.expires_at is null or p.expires_at > timezone('utc', now()))
  where d.id = requested_document_id
    and d.lead_id = p.lead_id
    and d.visible_in_portal = true
    and exists (select 1 from jsonb_array_elements(p.documents) item where item->>'id' = requested_document_id::text);
$$;

revoke all on function public.get_portal_document_path(text, uuid) from public;
grant execute on function public.get_portal_document_path(text, uuid) to anon, authenticated;
