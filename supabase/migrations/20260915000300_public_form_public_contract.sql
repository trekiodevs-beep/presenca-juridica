create or replace function public.get_public_form_by_slug(requested_slug text)
returns table (
  slug text,
  office_id uuid,
  office_name text,
  lawyer_name text,
  whatsapp text,
  city text,
  state text,
  areas jsonb,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.slug,
    f.office_id,
    f.office_name,
    f.lawyer_name,
    f.whatsapp,
    f.city,
    f.state,
    f.areas,
    f.is_active
  from public.public_forms as f
  where requested_slug is not null
    and length(trim(requested_slug)) between 1 and 120
    and lower(trim(requested_slug)) ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and f.slug = lower(trim(requested_slug))
    and f.is_active = true
  limit 1;
$$;

revoke all on function public.get_public_form_by_slug(text) from public;
grant execute on function public.get_public_form_by_slug(text) to anon, authenticated;
